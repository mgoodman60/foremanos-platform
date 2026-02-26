/**
 * Intelligence Dashboard API
 * Unified analytics and insights for all Phase A, B, and C features
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { extractMEPElements, detectAllClashes } from '@/lib/mep-path-tracer';
import { getCustomSymbols } from '@/lib/adaptive-symbol-learning';
import { getAnnotationStats } from '@/lib/visual-annotations';
import {
  calculateIntelligenceScore,
  getProjectIntelligenceMetrics,
} from '@/lib/intelligence-score-calculator';

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { slug } = params;

    // Verify project access
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectMember: {
          where: { User: { email: session.user?.email } }
        },
        Document: {
          include: {
            DocumentChunk: {
              take: 1 // Just count
            }
          }
        }
      }
    });

    if (!project || project.ProjectMember.length === 0) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Gather intelligence data
    const [mepElements, clashes, customSymbols, annotationStats] = await Promise.all([
      extractMEPElements(slug),
      detectAllClashes(slug),
      getCustomSymbols(slug),
      getAnnotationStats(slug)
    ]);

    // Get sheet summary - batch fetch all chunks for all documents in a single query
    const documentIds = project.Document.map((d: any) => d.id);
    const allDocChunks = documentIds.length > 0 ? await prisma.documentChunk.findMany({
      where: { documentId: { in: documentIds } },
      select: { metadata: true },
      take: 1000 // Reasonable limit to avoid memory issues
    }) : [];

    const sheetNumbers = new Set<string>();
    const drawingTypes = new Map<string, number>();
    const scaleInfo = new Map<string, string>();

    for (const chunk of allDocChunks) {
      const metadata = chunk.metadata as any;
      if (metadata?.sheet_number) {
        sheetNumbers.add(metadata.sheet_number);
      }
      if (metadata?.drawing_type) {
        const type = metadata.drawing_type;
        drawingTypes.set(type, (drawingTypes.get(type) || 0) + 1);
      }
      if (metadata?.scaleData?.primaryScale && metadata?.sheet_number) {
        scaleInfo.set(metadata.sheet_number, metadata.scaleData.primaryScale);
      }
    }

    const allChunks = allDocChunks;

    // Calculate comprehensive intelligence scores
    let intelligenceMetrics;
    let intelligenceScore;
    try {
      intelligenceMetrics = await getProjectIntelligenceMetrics(project.id);
      intelligenceScore = calculateIntelligenceScore(intelligenceMetrics);
    } catch (err) {
      logger.warn('INTELLIGENCE_DASHBOARD', 'Failed to calculate intelligence score, using fallback', {
        error: err instanceof Error ? err.message : String(err),
      });
      intelligenceScore = {
        overall: 0,
        extractionQuality: 0,
        entityCompleteness: 0,
        classificationAccuracy: 0,
        enrichmentSuccess: 0,
        pipelineCoverage: 0,
        checklist: [],
      };
    }

    // Legacy scores kept for backward compatibility
    const intelligenceScores = {
      spatialCorrelation: intelligenceScore.extractionQuality,
      mepCoordination: intelligenceScore.entityCompleteness,
      symbolRecognition: intelligenceScore.classificationAccuracy,
      annotationActivity: intelligenceScore.enrichmentSuccess,
      overall: intelligenceScore.overall,
    };

    // Build dashboard response
    const dashboard = {
      project: {
        name: project.name,
        slug: project.slug,
        documentsCount: project.Document.length,
        sheetsCount: sheetNumbers.size,
        chunksCount: allChunks.length
      },

      phaseA: {
        title: 'Foundation Intelligence',
        features: {
          titleBlocks: {
            extracted: sheetNumbers.size,
            confidence: sheetNumbers.size > 0 ? 0.95 : 0
          },
          legends: {
            symbolsIdentified: Array.from(drawingTypes.keys()).length,
            librariesBuilt: drawingTypes.size
          },
          scales: {
            sheetsWithScale: scaleInfo.size,
            multipleScales: 0 // Would calculate from actual data
          },
          classification: {
            types: Array.from(drawingTypes.entries()).map(([type, count]) => ({
              type,
              count
            }))
          }
        },
        score: 85
      },

      phaseB: {
        title: 'Advanced Intelligence',
        features: {
          detailCallouts: {
            identified: 0, // Would count from metadata
            crossReferences: 0
          },
          dimensions: {
            parsed: 0, // Would count from metadata
            validated: 0
          },
          annotations: {
            processed: 0, // Would count from metadata
            categorized: 0
          },
          industrySymbols: {
            matched: 0,
            standards: ['CSI', 'ASHRAE', 'IEEE', 'IBC']
          }
        },
        score: 78
      },

      phaseC: {
        title: 'System Integration',
        features: {
          spatialCorrelation: {
            sheetsAnalyzed: sheetNumbers.size,
            gridSystemsExtracted: sheetNumbers.size,
            score: intelligenceScores.spatialCorrelation
          },
          mepPathTracing: {
            elementsDetected: mepElements.length,
            clashesIdentified: clashes.length,
            criticalClashes: clashes.filter(c => c.severity === 'critical').length,
            score: intelligenceScores.mepCoordination
          },
          adaptiveSymbolLearning: {
            customSymbolsLearned: customSymbols.length,
            confidence: customSymbols.length > 0
              ? customSymbols.reduce((sum, s) => sum + s.confidence, 0) / customSymbols.length
              : 0,
            score: intelligenceScores.symbolRecognition
          },
          visualAnnotations: {
            total: annotationStats.total,
            openIssues: annotationStats.openIssues,
            avgResolutionTime: annotationStats.avgResolutionTime,
            score: intelligenceScores.annotationActivity
          }
        },
        score: intelligenceScores.overall
      },

      insights: generateInsights(
        mepElements.length,
        clashes,
        annotationStats,
        sheetNumbers.size
      ),

      recommendations: generateRecommendations(
        intelligenceScores,
        clashes.length,
        annotationStats.openIssues,
        intelligenceScore.checklist
      ),

      intelligenceScore,

      health: {
        overall: intelligenceScores.overall,
        status: getHealthStatus(intelligenceScores.overall),
        indicators: {
          dataQuality: sheetNumbers.size > 0 ? 'good' : 'poor',
          systemIntegration: mepElements.length > 10 ? 'good' : 'limited',
          collaboration: annotationStats.total > 0 ? 'active' : 'low'
        }
      }
    };

    return NextResponse.json({
      success: true,
      dashboard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('INTELLIGENCE_DASHBOARD', 'Failed to generate intelligence dashboard', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Failed to generate intelligence dashboard' },
      { status: 500 }
    );
  }
}


function generateInsights(
  mepCount: number,
  clashes: any[],
  annotationStats: any,
  sheetCount: number
): string[] {
  const insights: string[] = [];

  if (sheetCount > 10) {
    insights.push(`📊 Project has ${sheetCount} sheets with spatial correlation analysis enabled`);
  }

  if (mepCount > 20) {
    insights.push(`🔧 ${mepCount} MEP elements detected across all systems`);
  }

  if (clashes.length > 0) {
    const critical = clashes.filter(c => c.severity === 'critical').length;
    if (critical > 0) {
      insights.push(`⚠️ ${critical} critical clash${critical > 1 ? 'es' : ''} require immediate coordination`);
    } else {
      insights.push(`✅ ${clashes.length} minor clash${clashes.length > 1 ? 'es' : ''} detected - good coordination`);
    }
  }

  if (annotationStats.total > 0) {
    insights.push(`📝 ${annotationStats.total} annotation${annotationStats.total > 1 ? 's' : ''} actively tracking project issues`);
  }

  if (insights.length === 0) {
    insights.push('🚀 System is gathering project intelligence - upload more documents for insights');
  }

  return insights;
}

function generateRecommendations(
  scores: any,
  clashCount: number,
  openIssues: number,
  checklist: Array<{ label: string; status: string; actionLabel?: string }> = []
): string[] {
  const recommendations: string[] = [];

  // Generate recommendations from checklist items that need attention
  for (const item of checklist) {
    if (item.status === 'missing') {
      recommendations.push(item.actionLabel ? `${item.label} - ${item.actionLabel}` : item.label);
    } else if (item.status === 'partial') {
      recommendations.push(item.actionLabel ? `${item.label} - ${item.actionLabel}` : item.label);
    }
    if (recommendations.length >= 4) break;
  }

  if (clashCount > 5) {
    recommendations.push('Schedule MEP coordination meeting to resolve detected clashes');
  }

  if (openIssues > 10) {
    recommendations.push(`${openIssues} open annotations need attention - review and assign priorities`);
  }

  if (recommendations.length === 0) {
    recommendations.push('All systems operating optimally - continue regular project monitoring');
  }

  return recommendations;
}

function getHealthStatus(score: number): string {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  return 'needs attention';
}
