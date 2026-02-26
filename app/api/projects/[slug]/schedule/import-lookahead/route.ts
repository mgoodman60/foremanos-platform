import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { addDays, parseISO, startOfWeek } from 'date-fns';
import { EXTRACTION_MODEL } from '@/lib/model-config';
import { callLLM } from '@/lib/llm-providers';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULE_IMPORT_LOOKAHEAD');

// POST /api/projects/[slug]/schedule/import-lookahead - Import 3WLA from Excel
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Get project
    const project = await prisma.project.findFirst({
      where: { slug: params.slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get or create active schedule
    let schedule = await prisma.schedule.findFirst({
      where: { projectId: project.id, isActive: true }
    });

    if (!schedule) {
      const now = new Date();
      schedule = await prisma.schedule.create({
        data: {
          projectId: project.id,
          name: '3-Week Lookahead',
          description: 'Imported from Excel',
          startDate: startOfWeek(now, { weekStartsOn: 1 }),
          endDate: addDays(startOfWeek(now, { weekStartsOn: 1 }), 21),
          isActive: true,
          version: 1,
          createdBy: session.user.id
        }
      });
    }

    // Read Excel file using LLM API
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    // Use LLM to extract 3WLA data from Excel
    const mediaType = file.type.includes('sheet') || file.name.endsWith('.xlsx')
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv';

    const llmResult = await callLLM(
      [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64
              }
            },
            {
              type: 'text',
              text: `Extract all tasks from this 3-week lookahead schedule Excel file.

The format typically has:
- Subcontractor/trade headers (e.g., "Olympic", "KHI", "BMV Electric")
- Task descriptions in the first column
- X marks indicating which days the task is scheduled
- 3 weeks of dates (M, T, W, TH, F, Sa, Su for each week)

For each task, identify:
- name: The task description
- subcontractor: The subcontractor/trade name from the section header
- scheduledDays: Array of date strings (YYYY-MM-DD format) when the task has an X
- status: "completed" if in green/completed section, "in-progress" if in yellow section, otherwise "not-started"

Return as a JSON object with:
{
  "weekStartDate": "YYYY-MM-DD",  // First Monday of the 3-week period
  "subcontractors": ["Olympic", "KHI", ...],
  "tasks": [
    {
      "name": "Form/Pour remaining stem walls",
      "subcontractor": "Olympic",
      "scheduledDays": ["2025-03-26", "2025-03-27"],
      "status": "not-started"
    },
    ...
  ]
}

Only return the JSON object, no other text.`
            }
          ] as any
        }
      ],
      { model: EXTRACTION_MODEL, max_tokens: 8192 }
    );

    const content = llmResult.content || '';
    
    // Parse JSON from LLM response
    let parsedData: {
      weekStartDate?: string;
      subcontractors?: string[];
      tasks?: Array<{
        name: string;
        subcontractor?: string;
        scheduledDays?: string[];
        status?: string;
      }>;
    } = {};
    
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      logger.error('Failed to parse LLM response', e);
      return NextResponse.json(
        { error: 'Failed to parse schedule data from file' },
        { status: 500 }
      );
    }

    // Get existing subcontractors for mapping
    const existingSubcontractors = await prisma.subcontractor.findMany({
      where: { projectId: project.id }
    });
    
    const subcontractorMap = new Map<string, string>();
    existingSubcontractors.forEach(sub => {
      subcontractorMap.set(sub.companyName.toLowerCase(), sub.id);
    });

    // Create new subcontractors if needed
    if (parsedData.subcontractors) {
      for (const subName of parsedData.subcontractors) {
        if (!subcontractorMap.has(subName.toLowerCase())) {
          try {
            const newSub = await prisma.subcontractor.create({
              data: {
                projectId: project.id,
                companyName: subName,
                tradeType: 'general_contractor' as any, // TradeType enum
                isActive: true
              }
            });
            subcontractorMap.set(subName.toLowerCase(), newSub.id);
          } catch (e) {
            // Subcontractor may already exist with different case
            logger.info('Could not create subcontractor', { subName, error: e });
          }
        }
      }
    }

    // Create tasks
    let tasksCreated = 0;
    const tasks = parsedData.tasks || [];

    for (const task of tasks) {
      if (!task.name || !task.scheduledDays || task.scheduledDays.length === 0) continue;
      
      // Sort dates to get start and end
      const sortedDates = task.scheduledDays.sort();
      const startDate = parseISO(sortedDates[0]);
      const endDate = parseISO(sortedDates[sortedDates.length - 1]);
      
      // Get subcontractor ID
      const subcontractorId = task.subcontractor 
        ? subcontractorMap.get(task.subcontractor.toLowerCase())
        : null;
      
      // Map status
      let status: 'not_started' | 'in_progress' | 'completed' = 'not_started';
      if (task.status === 'completed') status = 'completed';
      else if (task.status === 'in-progress') status = 'in_progress';
      
      // Check if task already exists
      const existing = await prisma.scheduleTask.findFirst({
        where: {
          scheduleId: schedule.id,
          name: task.name
        }
      });

      if (existing) {
        // Update existing task
        await prisma.scheduleTask.update({
          where: { id: existing.id },
          data: {
            startDate,
            endDate,
            status,
            subcontractorId
          }
        });
      } else {
        // Create new task
        await prisma.scheduleTask.create({
          data: {
            scheduleId: schedule.id,
            taskId: `3WLA-${Date.now()}-${tasksCreated}`,
            name: task.name,
            startDate,
            endDate,
            duration: Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))),
            percentComplete: status === 'completed' ? 100 : status === 'in_progress' ? 50 : 0,
            status,
            isCritical: false,
            predecessors: [],
            successors: [],
            subcontractorId
          }
        });
        tasksCreated++;
      }
    }

    return NextResponse.json({
      success: true,
      tasksCreated,
      totalTasks: tasks.length,
      subcontractorsCreated: parsedData.subcontractors?.length || 0
    });
  } catch (error) {
    logger.error('Error importing 3WLA', error);
    return NextResponse.json(
      { error: 'Failed to import 3-week lookahead' },
      { status: 500 }
    );
  }
}
