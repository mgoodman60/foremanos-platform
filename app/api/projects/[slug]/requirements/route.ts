import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { extractAllRequirements, getAvailableCategories } from '@/lib/submittal-requirement-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_REQUIREMENTS');

/**
 * GET: Get all extracted requirements for a project
 */
export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const specSection = url.searchParams.get('specSection');

    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true, name: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Extract all requirements
    const requirements = await extractAllRequirements(project.id);
    const categories = await getAvailableCategories(project.id);

    // Apply filters if provided
    let filteredCategories = requirements.categories;
    
    if (category) {
      filteredCategories = {
        ...Object.fromEntries(
          Object.entries(filteredCategories).map(([key, _]) => [key, []])
        ),
        [category]: requirements.categories[category as keyof typeof requirements.categories] || []
      } as typeof requirements.categories;
    }

    if (specSection) {
      filteredCategories = Object.fromEntries(
        Object.entries(filteredCategories).map(([key, items]) => [
          key,
          items.filter(item => item.specSection.startsWith(specSection))
        ])
      ) as typeof requirements.categories;
    }

    return NextResponse.json({
      project: { id: project.id, name: project.name },
      requirements: {
        ...requirements,
        categories: filteredCategories
      },
      availableCategories: categories,
      filters: { category, specSection }
    });
  } catch (error) {
    logger.error('[Requirements GET] Error', error);
    return NextResponse.json({ error: 'Failed to fetch requirements' }, { status: 500 });
  }
}
