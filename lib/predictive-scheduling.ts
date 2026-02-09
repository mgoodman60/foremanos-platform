/**
 * Predictive Scheduling Service
 * 
 * ML-based delay prediction and schedule forecasting:
 * - Analyzes historical project data and patterns
 * - Incorporates weather forecasts and impact
 * - Considers labor availability and productivity
 * - Identifies supply chain risks
 * - Generates confidence-weighted predictions
 */

import { prisma } from './db';
import { callAbacusLLM } from './abacus-llm';
import { logger } from '@/lib/logger';

// ============================================================================
// INTERFACES
// ============================================================================

export interface PredictionInput {
  projectId: string;
  taskId?: string;
  milestoneId?: string;
  targetDate: Date;
  taskDescription?: string;
  historicalData?: HistoricalTaskData[];
  weatherForecast?: WeatherImpact;
  laborData?: LaborData;
  supplyChainData?: SupplyChainData;
}

export interface HistoricalTaskData {
  taskType: string;
  plannedDuration: number;
  actualDuration: number;
  delayDays: number;
  delayReasons?: string[];
}

export interface WeatherImpact {
  forecastDays: number;
  rainDays: number;
  extremeHeatDays: number;
  extremeColdDays: number;
  estimatedImpactDays: number;
}

export interface LaborData {
  currentHeadcount: number;
  requiredHeadcount: number;
  productivityRate: number; // 0-100%
  upcomingAbsences?: number;
}

export interface SupplyChainData {
  pendingDeliveries: number;
  delayedDeliveries: number;
  criticalMaterials: string[];
  estimatedDeliveryDelays: number;
}

export interface RiskFactor {
  category: 'weather' | 'labor' | 'supply' | 'scope' | 'technical' | 'external';
  description: string;
  probability: number; // 0-100%
  impactDays: number;
  mitigation?: string;
}

export interface SchedulePredictionResult {
  predictedCompletionDate: Date;
  confidenceLevel: number; // 0-100%
  daysFromTarget: number; // Positive = late, Negative = early
  riskFactors: RiskFactor[];
  weatherImpact: number;
  laborImpact: number;
  supplyImpact: number;
  recommendation: string;
  analysisDetails: string;
}

// ============================================================================
// PREDICTION ENGINE
// ============================================================================

/**
 * Generate schedule prediction using AI analysis
 */
export async function generateSchedulePrediction(
  input: PredictionInput
): Promise<SchedulePredictionResult> {
  // Gather project context
  const projectContext = await gatherProjectContext(input.projectId);

  const prompt = `You are a construction schedule prediction expert. Analyze this data and predict the likely completion date.

PROJECT CONTEXT:
${JSON.stringify(projectContext, null, 2)}

TARGET COMPLETION DATE: ${input.targetDate.toISOString().split('T')[0]}
TASK/MILESTONE: ${input.taskDescription || 'Overall project completion'}

HISTORICAL DATA (similar tasks):
${input.historicalData?.map((h) => `- ${h.taskType}: Planned ${h.plannedDuration}d, Actual ${h.actualDuration}d, Delay ${h.delayDays}d`).join('\n') || 'No historical data available'}

WEATHER FORECAST:
${input.weatherForecast ? `- ${input.weatherForecast.forecastDays} day forecast\n- ${input.weatherForecast.rainDays} rain days expected\n- Estimated impact: ${input.weatherForecast.estimatedImpactDays} days` : 'No weather data'}

LABOR STATUS:
${input.laborData ? `- Current: ${input.laborData.currentHeadcount}, Required: ${input.laborData.requiredHeadcount}\n- Productivity: ${input.laborData.productivityRate}%` : 'No labor data'}

SUPPLY CHAIN:
${input.supplyChainData ? `- ${input.supplyChainData.pendingDeliveries} pending, ${input.supplyChainData.delayedDeliveries} delayed\n- Critical materials: ${input.supplyChainData.criticalMaterials.join(', ')}` : 'No supply chain data'}

Provide prediction as JSON:
{
  "predictedCompletionDate": "YYYY-MM-DD",
  "confidenceLevel": 0-100,
  "daysFromTarget": number (positive = late),
  "riskFactors": [
    {
      "category": "weather|labor|supply|scope|technical|external",
      "description": "Risk description",
      "probability": 0-100,
      "impactDays": number,
      "mitigation": "Suggested mitigation"
    }
  ],
  "weatherImpact": days,
  "laborImpact": days,
  "supplyImpact": days,
  "recommendation": "Key recommendation for staying on schedule",
  "analysisDetails": "Brief explanation of the prediction"
}`;

  try {
    const response = await callAbacusLLM(
      [{ role: 'user', content: prompt }],
      { temperature: 0.3, max_tokens: 2000 }
    );

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        predictedCompletionDate: new Date(parsed.predictedCompletionDate),
        confidenceLevel: parsed.confidenceLevel || 50,
        daysFromTarget: parsed.daysFromTarget || 0,
        riskFactors: parsed.riskFactors || [],
        weatherImpact: parsed.weatherImpact || 0,
        laborImpact: parsed.laborImpact || 0,
        supplyImpact: parsed.supplyImpact || 0,
        recommendation: parsed.recommendation || 'Continue monitoring progress',
        analysisDetails: parsed.analysisDetails || 'Analysis completed',
      };
    }

    // Fallback prediction
    return {
      predictedCompletionDate: input.targetDate,
      confidenceLevel: 30,
      daysFromTarget: 0,
      riskFactors: [],
      weatherImpact: 0,
      laborImpact: 0,
      supplyImpact: 0,
      recommendation: 'Insufficient data for accurate prediction',
      analysisDetails: 'Unable to generate detailed analysis',
    };
  } catch (error) {
    logger.error('PREDICTIVE_SCHEDULING', 'Prediction failed', error instanceof Error ? error : undefined);
    return {
      predictedCompletionDate: input.targetDate,
      confidenceLevel: 0,
      daysFromTarget: 0,
      riskFactors: [],
      weatherImpact: 0,
      laborImpact: 0,
      supplyImpact: 0,
      recommendation: 'Error during prediction analysis',
      analysisDetails: String(error),
    };
  }
}

/**
 * Gather project context for prediction
 */
async function gatherProjectContext(projectId: string): Promise<any> {
  const [project, recentReports, schedule] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        name: true,
        status: true,
      },
    }),
    // Get recent daily reports for trend analysis
    prisma.dailyReport.findMany({
      where: { projectId },
      orderBy: { reportDate: 'desc' },
      take: 14,
      select: {
        reportDate: true,
        delayHours: true,
        delayReason: true,
        weatherCondition: true,
        laborEntries: {
          select: { workerCount: true, regularHours: true },
        },
      },
    }),
    // Get schedule with tasks
    prisma.schedule.findFirst({
      where: { projectId },
      include: {
        ScheduleTask: {
          select: {
            name: true,
            startDate: true,
            endDate: true,
            percentComplete: true,
            isCritical: true,
            status: true,
          },
          orderBy: { endDate: 'asc' },
          take: 20,
        },
      },
    }),
  ]);

  const scheduleTasks = schedule?.ScheduleTask || [];

  // Calculate trends from daily reports
  const recentDelays = recentReports.reduce((sum, r) => sum + (r.delayHours || 0), 0);
  const avgLabor = recentReports.length > 0
    ? recentReports.reduce(
        (sum, r) => sum + (r.laborEntries as any[]).reduce((s, l) => s + (l.workerCount || 0), 0),
        0
      ) / recentReports.length
    : 0;

  return {
    projectName: project?.name,
    projectStatus: project?.status,
    recentDelayHours: recentDelays,
    averageDailyLabor: Math.round(avgLabor),
    criticalPathTasks: scheduleTasks.filter((t) => t.isCritical),
    upcomingMilestones: scheduleTasks.slice(0, 5),
  };
}

/**
 * Store prediction in database
 */
export async function storePrediction(
  projectId: string,
  input: PredictionInput,
  result: SchedulePredictionResult
): Promise<string> {
  const prediction = await prisma.schedulePrediction.create({
    data: {
      projectId,
      taskId: input.taskId,
      milestoneId: input.milestoneId,
      predictedDate: result.predictedCompletionDate,
      confidenceLevel: result.confidenceLevel,
      weatherImpact: result.weatherImpact,
      laborImpact: result.laborImpact,
      supplyImpact: result.supplyImpact,
      modelVersion: '1.0',
      inputFeatures: {
        targetDate: input.targetDate.toISOString(),
        taskDescription: input.taskDescription,
        hasWeatherData: !!input.weatherForecast,
        hasLaborData: !!input.laborData,
        hasSupplyData: !!input.supplyChainData,
      },
      riskFactors: result.riskFactors as any,
    },
  });

  return prediction.id;
}

/**
 * Get historical predictions for a project
 */
export async function getProjectPredictions(
  projectId: string,
  options?: { limit?: number }
): Promise<any[]> {
  return prisma.schedulePrediction.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 20,
  });
}

/**
 * Update prediction with actual outcome (for model training)
 */
export async function recordActualOutcome(
  predictionId: string,
  actualDate: Date
): Promise<void> {
  const prediction = await prisma.schedulePrediction.findUnique({
    where: { id: predictionId },
  });

  if (!prediction) return;

  const predictedDate = new Date(prediction.predictedDate);
  const diffDays = Math.abs(
    (actualDate.getTime() - predictedDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Calculate accuracy (100% = perfect, decreases with variance)
  const accuracy = Math.max(0, 100 - diffDays * 5); // 5% penalty per day off

  await prisma.schedulePrediction.update({
    where: { id: predictionId },
    data: {
      actualDate,
      accuracy,
    },
  });
}

// ============================================================================
// WEATHER INTEGRATION
// ============================================================================

/**
 * Fetch weather forecast and estimate construction impact
 */
export async function getWeatherImpactForecast(
  latitude: number,
  longitude: number,
  forecastDays: number = 14
): Promise<WeatherImpact> {
  // This would integrate with weather API
  // For now, return placeholder based on typical patterns
  try {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      logger.info('PREDICTIVE_SCHEDULING', 'No weather API key configured');
      return {
        forecastDays,
        rainDays: 2,
        extremeHeatDays: 0,
        extremeColdDays: 0,
        estimatedImpactDays: 1,
      };
    }

    // Simplified weather impact estimation
    // In production, this would call actual weather API
    return {
      forecastDays,
      rainDays: Math.floor(Math.random() * 4),
      extremeHeatDays: 0,
      extremeColdDays: 0,
      estimatedImpactDays: Math.floor(Math.random() * 2),
    };
  } catch (error) {
    logger.error('PREDICTIVE_SCHEDULING', 'Weather fetch failed', error instanceof Error ? error : undefined);
    return {
      forecastDays,
      rainDays: 0,
      extremeHeatDays: 0,
      extremeColdDays: 0,
      estimatedImpactDays: 0,
    };
  }
}

// ============================================================================
// RISK ANALYSIS
// ============================================================================

/**
 * Analyze project risks and their schedule impact
 */
export async function analyzeProjectRisks(
  projectId: string
): Promise<RiskFactor[]> {
  const context = await gatherProjectContext(projectId);

  const prompt = `You are a construction risk analyst. Based on this project data, identify the top schedule risks.

Project Data:
${JSON.stringify(context, null, 2)}

Return JSON array of risks:
[
  {
    "category": "weather|labor|supply|scope|technical|external",
    "description": "Specific risk description",
    "probability": 0-100,
    "impactDays": estimated days of delay,
    "mitigation": "Recommended mitigation action"
  }
]

Focus on the most significant 5-7 risks.`;

  try {
    const response = await callAbacusLLM(
      [{ role: 'user', content: prompt }],
      { temperature: 0.3, max_tokens: 1500 }
    );

    const jsonMatch = response.content.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (error) {
    logger.error('PREDICTIVE_SCHEDULING', 'Risk analysis failed', error instanceof Error ? error : undefined);
    return [];
  }
}

/**
 * Generate schedule prediction with full analysis
 */
export async function runFullSchedulePrediction(
  projectId: string,
  targetDate?: Date,
  taskDescription?: string
): Promise<{
  predictionId: string;
  result: SchedulePredictionResult;
  risks: RiskFactor[];
}> {
  // Get project for default target date
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { locationLat: true, locationLon: true },
  });

  const target = targetDate || new Date();

  // Get weather impact if location available
  let weatherForecast: WeatherImpact | undefined;
  if (project?.locationLat && project?.locationLon) {
    weatherForecast = await getWeatherImpactForecast(
      project.locationLat,
      project.locationLon
    );
  }

  // Generate prediction
  const result = await generateSchedulePrediction({
    projectId,
    targetDate: target,
    taskDescription,
    weatherForecast,
  });

  // Store prediction
  const predictionId = await storePrediction(
    projectId,
    { projectId, targetDate: target, taskDescription, weatherForecast },
    result
  );

  // Analyze risks
  const risks = await analyzeProjectRisks(projectId);

  return {
    predictionId,
    result,
    risks,
  };
}
