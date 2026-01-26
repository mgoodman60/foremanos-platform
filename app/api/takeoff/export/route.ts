import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { generateTakeoffCSV, type TakeoffResult, type ExportOptions } from '@/lib/rag-enhancements';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { takeoff, options } = body as { takeoff: TakeoffResult; options?: ExportOptions };

    if (!takeoff || !takeoff.items || !Array.isArray(takeoff.items)) {
      return NextResponse.json({ error: 'Invalid takeoff data' }, { status: 400 });
    }

    // Generate CSV content
    const csvContent = generateTakeoffCSV(takeoff, options || {
      format: 'csv',
      includeRollups: true,
      includeMetadata: true,
    });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `takeoff_${takeoff.projectName.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.csv`;

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating takeoff export:', error);
    return NextResponse.json(
      { error: 'Failed to generate export' },
      { status: 500 }
    );
  }
}
