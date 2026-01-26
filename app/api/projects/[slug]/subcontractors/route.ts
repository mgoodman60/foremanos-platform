import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Valid trade types that match the schema
const VALID_TRADE_TYPES = [
  'general_contractor',
  'concrete_masonry', 
  'carpentry_framing',
  'electrical',
  'plumbing',
  'hvac_mechanical',
  'drywall_finishes',
  'site_utilities',
  'structural_steel',
  'roofing',
  'glazing_windows',
  'painting_coating',
  'flooring',
  // Legacy support
  'mechanical',
  'structural',
  'concrete',
  'painting',
  'general',
];

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get subcontractors
    const subcontractors = await prisma.subcontractor.findMany({
      where: {
        projectId: project.id,
      },
      orderBy: [
        { isActive: 'desc' },
        { companyName: 'asc' },
      ],
    });

    return NextResponse.json(subcontractors);
  } catch (error) {
    console.error('Error fetching subcontractors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subcontractors' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[slug]/subcontractors - Create a new subcontractor
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has access (admin or project member)
    if (user.role !== 'admin') {
      const membership = await prisma.projectMember.findFirst({
        where: {
          userId: user.id,
          Project: { slug: params.slug }
        }
      });
      
      if (!membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { companyName, tradeType, contactName, contactPhone, contactEmail } = body;

    // Validate required fields
    if (!companyName?.trim()) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    if (!tradeType) {
      return NextResponse.json(
        { error: 'Trade type is required' },
        { status: 400 }
      );
    }

    // Validate trade type
    if (!VALID_TRADE_TYPES.includes(tradeType)) {
      return NextResponse.json(
        { error: `Invalid trade type. Valid types: ${VALID_TRADE_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Create subcontractor
    const subcontractor = await prisma.subcontractor.create({
      data: {
        projectId: project.id,
        companyName: companyName.trim(),
        tradeType: tradeType as any,
        contactName: contactName?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
        contactEmail: contactEmail?.trim() || null,
        isActive: true,
      }
    });

    return NextResponse.json(subcontractor, { status: 201 });
  } catch (error: any) {
    console.error('[SUBCONTRACTORS_POST] Error:', error);
    
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A subcontractor with this company name already exists in this project' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create subcontractor' },
      { status: 500 }
    );
  }
}
