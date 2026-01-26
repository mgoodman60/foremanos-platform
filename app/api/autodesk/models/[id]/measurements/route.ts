import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'measurements');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getMeasurementsPath(modelId: string): string {
  return path.join(DATA_DIR, `${modelId}.json`);
}

// GET - Retrieve measurements for a model
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: modelId } = params;
    const filePath = getMeasurementsPath(modelId);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ measurements: [] });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return NextResponse.json({ measurements: data.measurements || [] });
  } catch (error) {
    console.error('[API] Get measurements error:', error);
    return NextResponse.json({ error: 'Failed to get measurements' }, { status: 500 });
  }
}

// POST - Save measurements for a model
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: modelId } = params;
    const body = await request.json();
    const { measurements } = body;

    if (!Array.isArray(measurements)) {
      return NextResponse.json({ error: 'Invalid measurements data' }, { status: 400 });
    }

    // Verify model exists
    const model = await prisma.autodeskModel.findUnique({
      where: { id: modelId },
    });

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    // Save measurements to file
    const filePath = getMeasurementsPath(modelId);
    const data = {
      modelId,
      measurements,
      updatedAt: new Date().toISOString(),
      updatedBy: session.user.id,
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    return NextResponse.json({
      success: true,
      count: measurements.length,
    });
  } catch (error) {
    console.error('[API] Save measurements error:', error);
    return NextResponse.json({ error: 'Failed to save measurements' }, { status: 500 });
  }
}
