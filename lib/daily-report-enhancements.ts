/**
 * Daily Report Enhancements
 * - Yesterday's carryover pre-population
 * - Report completeness scoring
 * - Trend analytics
 * - Voice transcription
 */

import { prisma } from '@/lib/db';
import OpenAI from 'openai';
import { EXTRACTION_MODEL } from '@/lib/model-config';

let openaiInstance: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }
  return openaiInstance;
}

// ============================================
// CARRYOVER PRE-POPULATION
// ============================================

export interface CarryoverData {
  workPlanned: string;  // From yesterday's "tomorrow plan"
  crewSize: number;     // Yesterday's crew count
  equipmentOnSite: Array<{ name: string; hours: number; status: string }>;
  scheduledTasks: Array<{ id: string; name: string; percentComplete: number }>;
  weatherForecast: {
    condition: string;
    high: number;
    low: number;
    precipitation: number;
  } | null;
  previousDelays: Array<{ reason: string; description: string }>;
}

/**
 * Get carryover data from yesterday's report to pre-populate today's
 */
export async function getYesterdayCarryover(projectId: string): Promise<CarryoverData | null> {
  try {
    // Get yesterday's report
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const lastReport = await prisma.dailyReport.findFirst({
      where: {
        projectId,
        reportDate: {
          gte: yesterday,
          lte: yesterdayEnd,
        },
      },
      include: {
        laborEntries: true,
      },
      orderBy: { reportDate: 'desc' },
    });

    // Get today's scheduled tasks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const schedule = await prisma.schedule.findFirst({
      where: { projectId, isActive: true },
      include: {
        ScheduleTask: {
          where: {
            OR: [
              { startDate: { lte: todayEnd }, endDate: { gte: today } },
              { percentComplete: { lt: 100 }, startDate: { lte: todayEnd } },
            ],
          },
          orderBy: { startDate: 'asc' },
          take: 10,
        },
      },
    });

    // Calculate yesterday's total crew
    const crewSize = lastReport?.laborEntries?.reduce(
      (sum, entry) => sum + entry.workerCount,
      0
    ) || 0;

    // Parse equipment from yesterday
    const equipmentOnSite = (lastReport?.equipmentOnSite as unknown as Array<{ name: string; hours: number; status: string }>) || [];

    // Get any unresolved delays
    const recentDelays = await prisma.dailyReport.findMany({
      where: {
        projectId,
        delayReason: { not: null },
        reportDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: {
        delayReason: true,
        delaysEncountered: true,
      },
      take: 5,
    });

    return {
      workPlanned: lastReport?.workPlanned || '',
      crewSize,
      equipmentOnSite,
      scheduledTasks: schedule?.ScheduleTask.map(t => ({
        id: t.id,
        name: t.name,
        percentComplete: t.percentComplete || 0,
      })) || [],
      weatherForecast: null, // Will be populated by weather service
      previousDelays: recentDelays
        .filter(d => d.delayReason)
        .map(d => ({
          reason: d.delayReason!,
          description: d.delaysEncountered || '',
        })),
    };
  } catch (error) {
    console.error('[Carryover] Error:', error);
    return null;
  }
}

// ============================================
// COMPLETENESS SCORING
// ============================================

export interface CompletenessScore {
  overall: number; // 0-100
  sections: {
    name: string;
    score: number;
    weight: number;
    missing: string[];
  }[];
  suggestions: string[];
  trend: 'improving' | 'declining' | 'stable';
  averageScore: number; // Last 7 days
}

const SECTION_WEIGHTS = {
  weather: 10,
  workPerformed: 25,
  laborHours: 20,
  equipment: 10,
  materials: 10,
  safety: 15,
  photos: 10,
};

/**
 * Calculate completeness score for a daily report
 */
export function calculateCompletenessScore(report: {
  weatherCondition?: string | null;
  temperatureHigh?: number | null;
  workPerformed?: string | null;
  workPlanned?: string | null;
  laborEntries?: Array<{ workerCount: number; regularHours: number }>;
  equipmentOnSite?: unknown;
  materialsReceived?: unknown;
  safetyNotes?: string | null;
  safetyIncidents?: number;
  photoIds?: string[];
  delaysEncountered?: string | null;
}): CompletenessScore {
  const sections: CompletenessScore['sections'] = [];

  // Weather section
  const weatherMissing: string[] = [];
  let weatherScore = 0;
  if (report.weatherCondition) weatherScore += 50;
  else weatherMissing.push('Weather condition');
  if (report.temperatureHigh !== null && report.temperatureHigh !== undefined) weatherScore += 50;
  else weatherMissing.push('Temperature');
  sections.push({
    name: 'Weather',
    score: weatherScore,
    weight: SECTION_WEIGHTS.weather,
    missing: weatherMissing,
  });

  // Work performed section
  const workMissing: string[] = [];
  let workScore = 0;
  if (report.workPerformed && report.workPerformed.length > 20) {
    workScore += 60;
  } else if (report.workPerformed) {
    workScore += 30;
    workMissing.push('More detail on work performed');
  } else {
    workMissing.push('Work performed summary');
  }
  if (report.workPlanned && report.workPlanned.length > 10) {
    workScore += 40;
  } else {
    workMissing.push('Tomorrow\'s plan');
  }
  sections.push({
    name: 'Work Summary',
    score: workScore,
    weight: SECTION_WEIGHTS.workPerformed,
    missing: workMissing,
  });

  // Labor hours section
  const laborMissing: string[] = [];
  let laborScore = 0;
  const laborEntries = report.laborEntries || [];
  if (laborEntries.length > 0) {
    laborScore += 60;
    const hasHours = laborEntries.some(e => e.regularHours > 0);
    if (hasHours) laborScore += 40;
    else laborMissing.push('Hours worked per trade');
  } else {
    laborMissing.push('Labor/crew information');
  }
  sections.push({
    name: 'Labor Hours',
    score: laborScore,
    weight: SECTION_WEIGHTS.laborHours,
    missing: laborMissing,
  });

  // Equipment section
  const equipMissing: string[] = [];
  let equipScore = 0;
  const equipment = report.equipmentOnSite as Array<unknown> | null;
  if (equipment && equipment.length > 0) {
    equipScore = 100;
  } else {
    equipMissing.push('Equipment on site');
  }
  sections.push({
    name: 'Equipment',
    score: equipScore,
    weight: SECTION_WEIGHTS.equipment,
    missing: equipMissing,
  });

  // Materials section
  const materialsMissing: string[] = [];
  let materialsScore = 50; // Default to 50 if nothing received (that's okay)
  const materials = report.materialsReceived as Array<unknown> | null;
  if (materials && materials.length > 0) {
    materialsScore = 100;
  }
  sections.push({
    name: 'Materials',
    score: materialsScore,
    weight: SECTION_WEIGHTS.materials,
    missing: materialsMissing,
  });

  // Safety section
  const safetyMissing: string[] = [];
  let safetyScore = 0;
  if (report.safetyIncidents !== undefined) {
    safetyScore += 50;
  } else {
    safetyMissing.push('Safety incident count');
  }
  if (report.safetyNotes) {
    safetyScore += 50;
  } else {
    safetyMissing.push('Safety observations');
  }
  sections.push({
    name: 'Safety',
    score: safetyScore,
    weight: SECTION_WEIGHTS.safety,
    missing: safetyMissing,
  });

  // Photos section
  const photosMissing: string[] = [];
  let photosScore = 0;
  const photoCount = report.photoIds?.length || 0;
  if (photoCount >= 3) {
    photosScore = 100;
  } else if (photoCount >= 1) {
    photosScore = 60;
    photosMissing.push('More progress photos (aim for 3+)');
  } else {
    photosMissing.push('Progress photos');
  }
  sections.push({
    name: 'Photos',
    score: photosScore,
    weight: SECTION_WEIGHTS.photos,
    missing: photosMissing,
  });

  // Calculate overall weighted score
  const totalWeight = sections.reduce((sum, s) => sum + s.weight, 0);
  const weightedSum = sections.reduce((sum, s) => sum + (s.score * s.weight), 0);
  const overall = Math.round(weightedSum / totalWeight);

  // Generate suggestions
  const suggestions: string[] = [];
  for (const section of sections) {
    if (section.score < 60) {
      suggestions.push(...section.missing);
    }
  }

  return {
    overall,
    sections,
    suggestions: suggestions.slice(0, 5),
    trend: 'stable',
    averageScore: overall,
  };
}

/**
 * Get completeness trend over time
 */
export async function getCompletenessTrend(
  projectId: string,
  days: number = 14
): Promise<{ date: string; score: number }[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const reports = await prisma.dailyReport.findMany({
      where: {
        projectId,
        reportDate: { gte: startDate },
      },
      include: {
        laborEntries: true,
      },
      orderBy: { reportDate: 'asc' },
    });

    return reports.map(r => {
      const score = calculateCompletenessScore({
        weatherCondition: r.weatherCondition,
        temperatureHigh: r.temperatureHigh,
        workPerformed: r.workPerformed,
        workPlanned: r.workPlanned,
        laborEntries: r.laborEntries,
        equipmentOnSite: r.equipmentOnSite,
        materialsReceived: r.materialsReceived,
        safetyNotes: r.safetyNotes,
        safetyIncidents: r.safetyIncidents,
        photoIds: r.photoIds,
      });

      return {
        date: r.reportDate.toISOString().split('T')[0],
        score: score.overall,
      };
    });
  } catch (error) {
    console.error('[Completeness Trend] Error:', error);
    return [];
  }
}

// ============================================
// TREND ANALYTICS
// ============================================

export interface TrendAnalytics {
  delayAnalysis: {
    byReason: Record<string, { count: number; totalHours: number }>;
    topReasons: Array<{ reason: string; count: number; percentage: number }>;
    totalDelayDays: number;
  };
  productivityTrend: Array<{
    week: string;
    avgCrewSize: number;
    avgHoursWorked: number;
    tasksCompleted: number;
  }>;
  weatherImpact: {
    daysLostToWeather: number;
    commonConditions: Record<string, number>;
  };
  safetyMetrics: {
    totalIncidents: number;
    incidentFrequency: number; // per 200k hours
    daysWithoutIncident: number;
  };
}

/**
 * Calculate comprehensive trend analytics
 */
export async function getTrendAnalytics(
  projectId: string,
  daysBack: number = 30
): Promise<TrendAnalytics> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  try {
    const reports = await prisma.dailyReport.findMany({
      where: {
        projectId,
        reportDate: { gte: startDate },
      },
      include: {
        laborEntries: true,
      },
      orderBy: { reportDate: 'asc' },
    });

    // Delay analysis
    const delayByReason: Record<string, { count: number; totalHours: number }> = {};
    let totalDelayHours = 0;

    for (const report of reports) {
      if (report.delayReason) {
        if (!delayByReason[report.delayReason]) {
          delayByReason[report.delayReason] = { count: 0, totalHours: 0 };
        }
        delayByReason[report.delayReason].count++;
        delayByReason[report.delayReason].totalHours += report.delayHours || 0;
        totalDelayHours += report.delayHours || 0;
      }
    }

    const totalDelays = Object.values(delayByReason).reduce((sum, d) => sum + d.count, 0);
    const topReasons = Object.entries(delayByReason)
      .map(([reason, data]) => ({
        reason,
        count: data.count,
        percentage: totalDelays > 0 ? Math.round((data.count / totalDelays) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Productivity trend by week
    const weeklyData: Map<string, {
      crewSizes: number[];
      hoursWorked: number[];
      tasksCompleted: number;
    }> = new Map();

    for (const report of reports) {
      const weekStart = getWeekStart(report.reportDate);
      if (!weeklyData.has(weekStart)) {
        weeklyData.set(weekStart, { crewSizes: [], hoursWorked: [], tasksCompleted: 0 });
      }
      const week = weeklyData.get(weekStart)!;
      
      const crewSize = report.laborEntries.reduce((sum, e) => sum + e.workerCount, 0);
      const hours = report.laborEntries.reduce(
        (sum, e) => sum + (e.workerCount * e.regularHours),
        0
      );
      
      week.crewSizes.push(crewSize);
      week.hoursWorked.push(hours);
    }

    const productivityTrend = Array.from(weeklyData.entries()).map(([week, data]) => ({
      week,
      avgCrewSize: Math.round(average(data.crewSizes)),
      avgHoursWorked: Math.round(average(data.hoursWorked)),
      tasksCompleted: data.tasksCompleted,
    }));

    // Weather impact
    const weatherConditions: Record<string, number> = {};
    let daysLostToWeather = 0;

    for (const report of reports) {
      if (report.weatherCondition) {
        weatherConditions[report.weatherCondition] = 
          (weatherConditions[report.weatherCondition] || 0) + 1;
      }
      if (report.delayReason?.toLowerCase().includes('weather')) {
        daysLostToWeather++;
      }
    }

    // Safety metrics
    const totalIncidents = reports.reduce((sum, r) => sum + (r.safetyIncidents || 0), 0);
    const totalHoursWorked = reports.reduce((sum, r) => 
      sum + r.laborEntries.reduce((h, e) => h + (e.workerCount * e.regularHours), 0), 0
    );
    const incidentFrequency = totalHoursWorked > 0
      ? Math.round((totalIncidents / totalHoursWorked) * 200000 * 100) / 100
      : 0;

    // Days without incident
    let daysWithoutIncident = 0;
    for (let i = reports.length - 1; i >= 0; i--) {
      if (reports[i].safetyIncidents === 0) {
        daysWithoutIncident++;
      } else {
        break;
      }
    }

    return {
      delayAnalysis: {
        byReason: delayByReason,
        topReasons,
        totalDelayDays: Math.round(totalDelayHours / 8),
      },
      productivityTrend,
      weatherImpact: {
        daysLostToWeather,
        commonConditions: weatherConditions,
      },
      safetyMetrics: {
        totalIncidents,
        incidentFrequency,
        daysWithoutIncident,
      },
    };
  } catch (error) {
    console.error('[Trend Analytics] Error:', error);
    return {
      delayAnalysis: { byReason: {}, topReasons: [], totalDelayDays: 0 },
      productivityTrend: [],
      weatherImpact: { daysLostToWeather: 0, commonConditions: {} },
      safetyMetrics: { totalIncidents: 0, incidentFrequency: 0, daysWithoutIncident: 0 },
    };
  }
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0];
}

function average(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

// ============================================
// VOICE TRANSCRIPTION
// ============================================

/**
 * Transcribe voice recording to structured daily report content
 */
export async function transcribeVoiceToReport(
  audioBase64: string,
  currentReport: Partial<{
    workPerformed: string;
    workPlanned: string;
    notes: string;
  }>
): Promise<{
  transcription: string;
  structured: {
    workPerformed?: string;
    workPlanned?: string;
    delays?: string;
    safety?: string;
    materials?: string;
    notes?: string;
  };
}> {
  try {
    // First, transcribe the audio using Whisper
    // Convert Buffer to proper File object for OpenAI API
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });

    const transcriptionResponse = await getOpenAI().audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });

    const transcription = transcriptionResponse.text;

    // Then, structure the transcription into report fields
    const structureResponse = await getOpenAI().chat.completions.create({
      model: EXTRACTION_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a construction daily report assistant. Parse spoken field notes into structured report sections.

Extract and organize the transcription into these sections:
- workPerformed: What work was done today
- workPlanned: What's planned for tomorrow
- delays: Any delays encountered
- safety: Safety observations or incidents
- materials: Materials received or needed
- notes: Other observations

Current report already has:
${currentReport.workPerformed ? `Work performed: ${currentReport.workPerformed}` : ''}
${currentReport.workPlanned ? `Tomorrow's plan: ${currentReport.workPlanned}` : ''}

Append new information to existing content where appropriate. Return JSON format.`,
        },
        {
          role: 'user',
          content: `Transcription: ${transcription}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1000,
    });

    const structured = JSON.parse(structureResponse.choices[0]?.message?.content || '{}');

    return {
      transcription,
      structured,
    };
  } catch (error) {
    console.error('[Voice Transcription] Error:', error);
    return {
      transcription: '',
      structured: {},
    };
  }
}

// ============================================
// EQUIPMENT TRACKING
// ============================================

export interface EquipmentEntry {
  name: string;
  hours: number;
  status: 'active' | 'idle' | 'maintenance' | 'offline';
  fuelUsed?: number;
  operatorId?: string;
  notes?: string;
}

export interface EquipmentSummary {
  totalEquipment: number;
  activeCount: number;
  totalHours: number;
  totalFuel: number;
  maintenanceAlerts: Array<{
    equipmentName: string;
    hoursUsed: number;
    nextServiceAt: number;
    urgency: 'low' | 'medium' | 'high';
  }>;
  utilizationRate: number;
}

/**
 * Get equipment tracking summary for a project
 */
export async function getEquipmentSummary(
  projectId: string,
  daysBack: number = 7
): Promise<EquipmentSummary> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  try {
    const reports = await prisma.dailyReport.findMany({
      where: {
        projectId,
        reportDate: { gte: startDate },
      },
      select: {
        equipmentOnSite: true,
      },
    });

    const equipmentUsage: Map<string, { totalHours: number; totalFuel: number; daysUsed: number }> = new Map();

    for (const report of reports) {
      const equipment = (report.equipmentOnSite as unknown as EquipmentEntry[]) || [];
      for (const e of equipment) {
        if (!equipmentUsage.has(e.name)) {
          equipmentUsage.set(e.name, { totalHours: 0, totalFuel: 0, daysUsed: 0 });
        }
        const usage = equipmentUsage.get(e.name)!;
        usage.totalHours += e.hours || 0;
        usage.totalFuel += e.fuelUsed || 0;
        usage.daysUsed++;
      }
    }

    const totalEquipment = equipmentUsage.size;
    const totalHours = Array.from(equipmentUsage.values()).reduce((sum, u) => sum + u.totalHours, 0);
    const totalFuel = Array.from(equipmentUsage.values()).reduce((sum, u) => sum + u.totalFuel, 0);

    // Generate maintenance alerts based on hours
    const MAINTENANCE_INTERVALS: Record<string, number> = {
      'excavator': 250,
      'loader': 250,
      'backhoe': 250,
      'crane': 500,
      'forklift': 200,
      'default': 300,
    };

    const maintenanceAlerts = Array.from(equipmentUsage.entries())
      .map(([name, usage]) => {
        const interval = Object.entries(MAINTENANCE_INTERVALS)
          .find(([type]) => name.toLowerCase().includes(type))?.[1] || MAINTENANCE_INTERVALS.default;
        
        const hoursRemaining = interval - (usage.totalHours % interval);
        let urgency: 'low' | 'medium' | 'high' = 'low';
        if (hoursRemaining < 25) urgency = 'high';
        else if (hoursRemaining < 50) urgency = 'medium';

        return {
          equipmentName: name,
          hoursUsed: usage.totalHours,
          nextServiceAt: interval - hoursRemaining + usage.totalHours,
          urgency,
        };
      })
      .filter(a => a.urgency !== 'low')
      .sort((a, b) => (a.urgency === 'high' ? -1 : 1) - (b.urgency === 'high' ? -1 : 1));

    // Calculate utilization rate (hours used vs potential hours)
    const potentialHours = totalEquipment * daysBack * 8; // 8 hours per day
    const utilizationRate = potentialHours > 0 ? Math.round((totalHours / potentialHours) * 100) : 0;

    return {
      totalEquipment,
      activeCount: equipmentUsage.size,
      totalHours,
      totalFuel,
      maintenanceAlerts,
      utilizationRate,
    };
  } catch (error) {
    console.error('[Equipment Summary] Error:', error);
    return {
      totalEquipment: 0,
      activeCount: 0,
      totalHours: 0,
      totalFuel: 0,
      maintenanceAlerts: [],
      utilizationRate: 0,
    };
  }
}
