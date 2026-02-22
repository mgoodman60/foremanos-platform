/**
 * Earthwork Calculation API
 * POST: Calculate cut/fill volumes from elevation data or documents
 * GET: Retrieve saved earthwork calculations for a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  calculateGridMethod,
  calculateAverageEndArea,
  calculateSimpleVolume,
  parseElevationData,
  generateEarthworkReport,
  EarthworkResult,
  SoilType,
  SOIL_FACTORS,
} from '@/lib/earthwork-calculator';
import {
  extractElevationsFromDocument,
  extractElevationsWithAI,
  mergeElevationSources,
  createElevationGrid,
  estimateFromSiteParams,
} from '@/lib/earthwork-extractor';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_EARTHWORK');

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const {
      method = 'simple',  // 'simple', 'grid', 'average-end-area', 'from-documents'
      soilType = 'mixed' as SoilType,
      // For simple method
      areaSF,
      avgCutDepthFt,
      avgFillDepthFt,
      // For grid method
      existingElevations,
      proposedElevations,
      gridSpacing = 25,
      // For average-end-area
      crossSections,
      // For document extraction
      documentIds,
      // Site params estimation
      siteParams,
    } = body;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let result: EarthworkResult;
    let extractionMetadata: any = null;

    switch (method) {
      case 'simple':
        // Quick estimate from area and depths
        if (!areaSF || (avgCutDepthFt === undefined && avgFillDepthFt === undefined)) {
          return NextResponse.json(
            { error: 'Simple method requires areaSF and at least one depth value' },
            { status: 400 }
          );
        }
        result = calculateSimpleVolume(
          areaSF,
          avgCutDepthFt || 0,
          avgFillDepthFt || 0,
          soilType
        );
        break;

      case 'grid':
        // Calculate from elevation grid
        if (!existingElevations?.length || !proposedElevations?.length) {
          return NextResponse.json(
            { error: 'Grid method requires existing and proposed elevation arrays' },
            { status: 400 }
          );
        }
        const grid = parseElevationData(existingElevations, proposedElevations, gridSpacing);
        if (!grid) {
          return NextResponse.json(
            { error: 'Could not create elevation grid from provided data' },
            { status: 400 }
          );
        }
        result = calculateGridMethod(grid, soilType);
        break;

      case 'average-end-area':
        // Calculate from cross-sections
        if (!crossSections?.length || crossSections.length < 2) {
          return NextResponse.json(
            { error: 'Average end area method requires at least 2 cross-sections' },
            { status: 400 }
          );
        }
        result = calculateAverageEndArea(crossSections, soilType);
        break;

      case 'from-documents':
        // Extract elevations from project documents
        if (!documentIds?.length) {
          return NextResponse.json(
            { error: 'Document extraction requires documentIds array' },
            { status: 400 }
          );
        }

        // Fetch documents
        const documents = await prisma.document.findMany({
          where: {
            id: { in: documentIds },
            projectId: project.id,
          },
          include: {
            DocumentChunk: { select: { content: true } },
          },
        });

        if (documents.length === 0) {
          return NextResponse.json(
            { error: 'No matching documents found' },
            { status: 404 }
          );
        }

        // Extract elevations from each document
        const extractedSources = [];
        for (const doc of documents) {
          const content = doc.DocumentChunk.map(c => c.content).join('\n');
          const docType = doc.name.toLowerCase().includes('survey') ? 'survey'
            : doc.name.toLowerCase().includes('grad') ? 'grading'
            : doc.name.toLowerCase().includes('geo') ? 'geotech'
            : 'plans';

          try {
            // Try AI extraction first for better results
            const apiKey = process.env.OPENAI_API_KEY;
            const extracted = apiKey
              ? await extractElevationsWithAI(content, docType, apiKey)
              : await extractElevationsFromDocument(content, docType);
            extractedSources.push(extracted);
          } catch (err) {
            logger.error('Failed to extract elevations', err, { document: doc.name });
          }
        }

        if (extractedSources.length === 0) {
          return NextResponse.json(
            { error: 'Could not extract elevation data from documents' },
            { status: 400 }
          );
        }

        // Merge sources
        const mergedData = mergeElevationSources(extractedSources);
        extractionMetadata = mergedData.metadata;

        // Try grid method first, fall back to cross-sections
        const elevGrid = createElevationGrid(mergedData, gridSpacing);
        if (elevGrid && elevGrid.points.length >= 9) {
          result = calculateGridMethod(elevGrid, soilType);
        } else if (mergedData.crossSections.length >= 2) {
          result = calculateAverageEndArea(mergedData.crossSections, soilType);
        } else {
          // Fall back to estimation from site params
          if (siteParams?.siteAreaSF) {
            const estimates = estimateFromSiteParams(siteParams);
            result = calculateSimpleVolume(
              siteParams.siteAreaSF,
              estimates.avgCutDepth,
              estimates.avgFillDepth,
              soilType
            );
            extractionMetadata.note = estimates.balanceEstimate;
          } else {
            return NextResponse.json(
              { error: 'Insufficient elevation data extracted. Please provide more detailed grading plans or survey data.' },
              { status: 400 }
            );
          }
        }
        break;

      default:
        return NextResponse.json(
          { error: `Unknown calculation method: ${method}` },
          { status: 400 }
        );
    }

    // Generate report
    const report = generateEarthworkReport(result);

    return NextResponse.json({
      success: true,
      result,
      report,
      extraction: extractionMetadata,
      soilFactors: SOIL_FACTORS,
    });

  } catch (error) {
    logger.error('[Earthwork API] Error', error);
    return NextResponse.json(
      { error: 'Failed to calculate earthwork volumes' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get documents that might contain earthwork data
    const relevantDocuments = await prisma.document.findMany({
      where: {
        projectId: project.id,
        OR: [
          { name: { contains: 'survey', mode: 'insensitive' } },
          { name: { contains: 'grad', mode: 'insensitive' } },
          { name: { contains: 'geo', mode: 'insensitive' } },
          { name: { contains: 'topo', mode: 'insensitive' } },
          { name: { contains: 'site', mode: 'insensitive' } },
          { name: { contains: 'civil', mode: 'insensitive' } },
          { name: { endsWith: '.dwg', mode: 'insensitive' } },
        ],
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      projectId: project.id,
      projectName: project.name,
      relevantDocuments,
      soilTypes: Object.keys(SOIL_FACTORS),
      methods: [
        { id: 'simple', name: 'Quick Estimate', description: 'From area and average depths' },
        { id: 'grid', name: 'Grid Method', description: 'From elevation point data' },
        { id: 'average-end-area', name: 'Average End Area', description: 'From cross-section data' },
        { id: 'from-documents', name: 'Extract from Documents', description: 'AI-powered extraction from plans' },
      ],
    });

  } catch (error) {
    logger.error('[Earthwork API] Error', error);
    return NextResponse.json(
      { error: 'Failed to get earthwork data' },
      { status: 500 }
    );
  }
}
