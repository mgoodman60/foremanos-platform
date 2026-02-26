import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { extractAllRequirements, autoImportRequirements, getAvailableCategories } from '@/lib/submittal-requirement-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_SUBMITTALS_AUTO_IMPORT');

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { slug, id: submittalId } = params;
    const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const submittal = await prisma.mEPSubmittal.findFirst({ where: { id: submittalId, projectId: project.id }, include: { lineItems: { select: { productName: true } } } });
    if (!submittal) return NextResponse.json({ error: 'Submittal not found' }, { status: 404 });
    const requirements = await extractAllRequirements(project.id);
    const categories = await getAvailableCategories(project.id);
    const existingProducts = new Set(submittal.lineItems.map(li => li.productName.toLowerCase()));
    return NextResponse.json({ submittal: { id: submittal.id, submittalNumber: submittal.submittalNumber, existingLineItems: submittal.lineItems.length }, requirements, availableCategories: categories, summary: { totalAvailable: requirements.totals.totalItems, wouldBeSkipped: Object.values(requirements.categories).flat().filter(item => existingProducts.has(item.productName.toLowerCase())).length } });
  } catch (error) { logger.error('[AutoImport GET] Error', error); return NextResponse.json({ error: 'Failed to fetch requirements' }, { status: 500 }); }
}

export async function POST(req: NextRequest, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { slug, id: submittalId } = params;
    const body = await req.json();
    const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const submittal = await prisma.mEPSubmittal.findFirst({ where: { id: submittalId, projectId: project.id } });
    if (!submittal) return NextResponse.json({ error: 'Submittal not found' }, { status: 404 });
    const result = await autoImportRequirements(submittalId, body.categoryFilter);
    return NextResponse.json({ success: true, imported: result.imported, skipped: result.skipped, errors: result.errors });
  } catch (error) { logger.error('[AutoImport POST] Error', error); return NextResponse.json({ error: 'Failed to import' }, { status: 500 }); }
}
