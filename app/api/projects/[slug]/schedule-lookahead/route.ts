import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { TRADE_DISPLAY_NAMES } from '@/lib/trade-inference';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULE_LOOKAHEAD');

export const dynamic = 'force-dynamic';

// Format trade type for display
function formatTradeType(trade: string): string {
  return TRADE_DISPLAY_NAMES[trade] || trade.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    const startDate = startParam ? new Date(startParam) : new Date();
    const endDate = endParam ? new Date(endParam) : new Date(Date.now() + 21 * 24 * 60 * 60 * 1000); // 3 weeks

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        Schedule: {
          include: {
            ScheduleTask: {
              where: {
                OR: [
                  {
                    startDate: {
                      gte: startDate,
                      lte: endDate
                    }
                  },
                  {
                    endDate: {
                      gte: startDate,
                      lte: endDate
                    }
                  },
                  {
                    AND: [
                      { startDate: { lte: startDate } },
                      { endDate: { gte: endDate } }
                    ]
                  }
                ]
              },
              include: {
                Subcontractor: {
                  select: {
                    id: true,
                    companyName: true,
                    tradeType: true,
                  }
                }
              },
              orderBy: { startDate: 'asc' }
            }
          }
        },
        ProjectMember: {
          include: {
            User: {
              select: {
                id: true,
                username: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get all tasks in the date range
    const allTasks = (project as any).Schedule.flatMap((s: any) => s.ScheduleTask);

    // Enhance tasks with additional info including trade/sub data
    const enhancedTasks = allTasks.map((task: any) => {
      // Find assigned member
      const assignedMember = (project as any).ProjectMember.find((m: any) => m.userId === task.assignedTo);
      const assignedName = assignedMember?.User.username || 'Unassigned';

      // Check for dependencies (simplified - in real app, would query actual dependencies)
      const hasDependencies = task.dependencies && task.dependencies.length > 0;

      // Determine trade display
      let tradeDisplay = '';
      let tradeSource: 'subcontractor' | 'inferred' | 'none' = 'none';
      let tradeConfidence: number | null = null;
      
      if (task.Subcontractor) {
        tradeDisplay = task.Subcontractor.companyName;
        tradeSource = 'subcontractor';
        tradeConfidence = 100;
      } else if (task.inferredTradeType) {
        tradeDisplay = formatTradeType(task.inferredTradeType);
        tradeSource = 'inferred';
        tradeConfidence = task.tradeInferenceConfidence;
      } else if (task.tradeType) {
        tradeDisplay = formatTradeType(task.tradeType);
        tradeSource = 'inferred';
        tradeConfidence = 100;
      }

      return {
        id: task.id,
        name: task.name,
        startDate: task.startDate.toISOString(),
        endDate: task.endDate.toISOString(),
        status: task.status,
        priority: task.priority,
        assignedTo: assignedName,
        dependencies: hasDependencies ? task.dependencies : [],
        // Trade information
        trade: tradeDisplay,
        tradeSource,
        tradeConfidence,
        needsClarification: task.tradeNeedsClarification || false,
        subcontractorId: task.subcontractorId,
        // Budget information
        budgetedCost: task.budgetedCost || 0,
        actualCost: task.actualCost || 0,
        percentComplete: task.percentComplete || 0,
      };
    });

    return NextResponse.json({
      tasks: enhancedTasks,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching schedule lookahead', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule lookahead' },
      { status: 500 }
    );
  }
}