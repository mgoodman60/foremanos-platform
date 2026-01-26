import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'markups');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getMarkupsPath(modelId: string): string {
  return path.join(DATA_DIR, `${modelId}.json`);
}

function getSvgPath(modelId: string): string {
  return path.join(DATA_DIR, `${modelId}.svg`);
}

// GET - Retrieve markups for a model
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
    const filePath = getMarkupsPath(modelId);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ markups: [], svg: null });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // Also get SVG if it exists
    const svgPath = getSvgPath(modelId);
    const svg = fs.existsSync(svgPath) ? fs.readFileSync(svgPath, 'utf-8') : null;

    return NextResponse.json({
      markups: data.markups || [],
      svg,
      updatedAt: data.updatedAt,
    });
  } catch (error) {
    console.error('[API] Get markups error:', error);
    return NextResponse.json({ error: 'Failed to get markups' }, { status: 500 });
  }
}

// POST - Save markups for a model
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
    const { markups, svg } = body;

    if (!Array.isArray(markups)) {
      return NextResponse.json({ error: 'Invalid markups data' }, { status: 400 });
    }

    // Verify model exists
    const model = await prisma.autodeskModel.findUnique({
      where: { id: modelId },
    });

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    // Save markups to file
    const filePath = getMarkupsPath(modelId);
    const data = {
      modelId,
      markups: markups.map((m: any) => ({
        ...m,
        createdBy: m.createdBy || session.user?.id,
      })),
      updatedAt: new Date().toISOString(),
      updatedBy: session.user.id,
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    // Save SVG if provided
    if (svg) {
      const svgPath = getSvgPath(modelId);
      fs.writeFileSync(svgPath, svg);
    }

    return NextResponse.json({
      success: true,
      count: markups.length,
    });
  } catch (error) {
    console.error('[API] Save markups error:', error);
    return NextResponse.json({ error: 'Failed to save markups' }, { status: 500 });
  }
}

// DELETE - Clear markups for a model
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: modelId } = params;
    const filePath = getMarkupsPath(modelId);
    const svgPath = getSvgPath(modelId);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    if (fs.existsSync(svgPath)) {
      fs.unlinkSync(svgPath);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Delete markups error:', error);
    return NextResponse.json({ error: 'Failed to delete markups' }, { status: 500 });
  }
}
