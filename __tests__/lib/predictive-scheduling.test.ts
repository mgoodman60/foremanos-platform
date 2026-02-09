import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PredictionInput,
  SchedulePredictionResult,
  RiskFactor,
  WeatherImpact,
  generateSchedulePrediction,
  storePrediction,
  getProjectPredictions,
  recordActualOutcome,
  getWeatherImpactForecast,
  analyzeProjectRisks,
  runFullSchedulePrediction,
} from '@/lib/predictive-scheduling';

const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  dailyReport: {
    findMany: vi.fn(),
  },
  schedule: {
    findFirst: vi.fn(),
  },
  schedulePrediction: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));

const mockAbacusLLM = vi.hoisted(() => ({
  callAbacusLLM: vi.fn(),
}));

vi.mock('@/lib/abacus-llm', () => mockAbacusLLM);

describe('predictive-scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSchedulePrediction', () => {
    it('should generate prediction with AI analysis', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        name: 'Test Project',
        status: 'ACTIVE',
      });

      mockPrisma.dailyReport.findMany.mockResolvedValue([
        {
          reportDate: new Date(),
          delayHours: 2,
          delayReason: 'Weather',
          weatherCondition: 'Rain',
          laborEntries: [{ workerCount: 10, regularHours: 8 }],
        },
      ]);

      mockPrisma.schedule.findFirst.mockResolvedValue({
        id: 'sched-1',
        ScheduleTask: [
          {
            name: 'Task 1',
            startDate: new Date(),
            endDate: new Date(),
            percentComplete: 50,
            isCritical: true,
            status: 'in_progress',
          },
        ],
      });

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          predictedCompletionDate: '2024-12-31',
          confidenceLevel: 85,
          daysFromTarget: 10,
          riskFactors: [
            {
              category: 'weather',
              description: 'Rain expected',
              probability: 70,
              impactDays: 3,
              mitigation: 'Schedule indoor work',
            },
          ],
          weatherImpact: 3,
          laborImpact: 1,
          supplyImpact: 0,
          recommendation: 'Monitor weather closely',
          analysisDetails: 'Weather is the primary risk factor',
        }),
      });

      const input: PredictionInput = {
        projectId: 'proj-1',
        targetDate: new Date('2024-12-21'),
        taskDescription: 'Project completion',
      };

      const result = await generateSchedulePrediction(input);

      expect(result.confidenceLevel).toBe(85);
      expect(result.daysFromTarget).toBe(10);
      expect(result.riskFactors).toHaveLength(1);
      expect(result.recommendation).toContain('weather');
    });

    it('should handle JSON wrapped in text', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ name: 'Test' });
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.schedule.findFirst.mockResolvedValue(null);

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: 'Some text before { "predictedCompletionDate": "2024-12-31", "confidenceLevel": 80, "daysFromTarget": 5, "riskFactors": [], "weatherImpact": 0, "laborImpact": 0, "supplyImpact": 0, "recommendation": "Continue", "analysisDetails": "OK" } more text',
      });

      const input: PredictionInput = {
        projectId: 'proj-1',
        targetDate: new Date('2024-12-26'),
      };

      const result = await generateSchedulePrediction(input);

      expect(result.confidenceLevel).toBe(80);
    });

    it('should fall back on parsing error', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ name: 'Test' });
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.schedule.findFirst.mockResolvedValue(null);

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: 'invalid json response',
      });

      const input: PredictionInput = {
        projectId: 'proj-1',
        targetDate: new Date('2024-12-31'),
      };

      const result = await generateSchedulePrediction(input);

      expect(result.confidenceLevel).toBe(30);
      expect(result.predictedCompletionDate).toEqual(input.targetDate);
      expect(result.recommendation).toContain('Insufficient data');
    });

    it('should handle LLM errors gracefully', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ name: 'Test' });
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.schedule.findFirst.mockResolvedValue(null);

      mockAbacusLLM.callAbacusLLM.mockRejectedValue(new Error('API error'));

      const input: PredictionInput = {
        projectId: 'proj-1',
        targetDate: new Date('2024-12-31'),
      };

      const result = await generateSchedulePrediction(input);

      expect(result.confidenceLevel).toBe(0);
      expect(result.recommendation).toContain('Error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should include historical data in prompt', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ name: 'Test' });
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.schedule.findFirst.mockResolvedValue(null);

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          predictedCompletionDate: '2024-12-31',
          confidenceLevel: 90,
          daysFromTarget: 0,
          riskFactors: [],
          weatherImpact: 0,
          laborImpact: 0,
          supplyImpact: 0,
          recommendation: 'OK',
          analysisDetails: 'Good',
        }),
      });

      const input: PredictionInput = {
        projectId: 'proj-1',
        targetDate: new Date('2024-12-31'),
        historicalData: [
          {
            taskType: 'Foundation',
            plannedDuration: 10,
            actualDuration: 12,
            delayDays: 2,
            delayReasons: ['Weather'],
          },
        ],
      };

      await generateSchedulePrediction(input);

      expect(mockAbacusLLM.callAbacusLLM).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('Foundation'),
          }),
        ]),
        expect.any(Object)
      );
    });

    it('should include weather forecast in prompt', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ name: 'Test' });
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.schedule.findFirst.mockResolvedValue(null);

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          predictedCompletionDate: '2024-12-31',
          confidenceLevel: 75,
          daysFromTarget: 5,
          riskFactors: [],
          weatherImpact: 3,
          laborImpact: 0,
          supplyImpact: 0,
          recommendation: 'OK',
          analysisDetails: 'Weather impact',
        }),
      });

      const input: PredictionInput = {
        projectId: 'proj-1',
        targetDate: new Date('2024-12-31'),
        weatherForecast: {
          forecastDays: 14,
          rainDays: 5,
          extremeHeatDays: 0,
          extremeColdDays: 0,
          estimatedImpactDays: 3,
        },
      };

      await generateSchedulePrediction(input);

      expect(mockAbacusLLM.callAbacusLLM).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('5 rain days'),
          }),
        ]),
        expect.any(Object)
      );
    });

    it('should include labor data in prompt', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ name: 'Test' });
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.schedule.findFirst.mockResolvedValue(null);

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          predictedCompletionDate: '2024-12-31',
          confidenceLevel: 80,
          daysFromTarget: 2,
          riskFactors: [],
          weatherImpact: 0,
          laborImpact: 2,
          supplyImpact: 0,
          recommendation: 'OK',
          analysisDetails: 'Labor shortage',
        }),
      });

      const input: PredictionInput = {
        projectId: 'proj-1',
        targetDate: new Date('2024-12-31'),
        laborData: {
          currentHeadcount: 8,
          requiredHeadcount: 10,
          productivityRate: 85,
        },
      };

      await generateSchedulePrediction(input);

      expect(mockAbacusLLM.callAbacusLLM).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('Current: 8, Required: 10'),
          }),
        ]),
        expect.any(Object)
      );
    });

    it('should include supply chain data in prompt', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ name: 'Test' });
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.schedule.findFirst.mockResolvedValue(null);

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          predictedCompletionDate: '2024-12-31',
          confidenceLevel: 70,
          daysFromTarget: 7,
          riskFactors: [],
          weatherImpact: 0,
          laborImpact: 0,
          supplyImpact: 7,
          recommendation: 'OK',
          analysisDetails: 'Supply delays',
        }),
      });

      const input: PredictionInput = {
        projectId: 'proj-1',
        targetDate: new Date('2024-12-24'),
        supplyChainData: {
          pendingDeliveries: 5,
          delayedDeliveries: 2,
          criticalMaterials: ['Steel', 'Concrete'],
          estimatedDeliveryDelays: 7,
        },
      };

      await generateSchedulePrediction(input);

      expect(mockAbacusLLM.callAbacusLLM).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('Steel, Concrete'),
          }),
        ]),
        expect.any(Object)
      );
    });
  });

  describe('storePrediction', () => {
    it('should store prediction in database', async () => {
      mockPrisma.schedulePrediction.create.mockResolvedValue({ id: 'pred-1' });

      const input: PredictionInput = {
        projectId: 'proj-1',
        targetDate: new Date('2024-12-31'),
        taskDescription: 'Test task',
      };

      const result: SchedulePredictionResult = {
        predictedCompletionDate: new Date('2025-01-05'),
        confidenceLevel: 85,
        daysFromTarget: 5,
        riskFactors: [],
        weatherImpact: 2,
        laborImpact: 3,
        supplyImpact: 0,
        recommendation: 'Monitor progress',
        analysisDetails: 'Analysis complete',
      };

      const predictionId = await storePrediction('proj-1', input, result);

      expect(predictionId).toBe('pred-1');
      expect(mockPrisma.schedulePrediction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          predictedDate: result.predictedCompletionDate,
          confidenceLevel: 85,
          weatherImpact: 2,
          laborImpact: 3,
          supplyImpact: 0,
          modelVersion: '1.0',
        }),
      });
    });

    it('should store input features', async () => {
      mockPrisma.schedulePrediction.create.mockResolvedValue({ id: 'pred-1' });

      const input: PredictionInput = {
        projectId: 'proj-1',
        targetDate: new Date('2024-12-31'),
        weatherForecast: { forecastDays: 14, rainDays: 3, extremeHeatDays: 0, extremeColdDays: 0, estimatedImpactDays: 2 },
        laborData: { currentHeadcount: 10, requiredHeadcount: 10, productivityRate: 90 },
      };

      const result: SchedulePredictionResult = {
        predictedCompletionDate: new Date('2024-12-31'),
        confidenceLevel: 90,
        daysFromTarget: 0,
        riskFactors: [],
        weatherImpact: 0,
        laborImpact: 0,
        supplyImpact: 0,
        recommendation: 'OK',
        analysisDetails: 'OK',
      };

      await storePrediction('proj-1', input, result);

      expect(mockPrisma.schedulePrediction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inputFeatures: expect.objectContaining({
            hasWeatherData: true,
            hasLaborData: true,
            hasSupplyData: false,
          }),
        }),
      });
    });
  });

  describe('getProjectPredictions', () => {
    it('should retrieve predictions for a project', async () => {
      mockPrisma.schedulePrediction.findMany.mockResolvedValue([
        { id: 'pred-1', projectId: 'proj-1', predictedDate: new Date(), confidenceLevel: 85 },
        { id: 'pred-2', projectId: 'proj-1', predictedDate: new Date(), confidenceLevel: 90 },
      ]);

      const predictions = await getProjectPredictions('proj-1');

      expect(predictions).toHaveLength(2);
      expect(mockPrisma.schedulePrediction.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    });

    it('should respect limit option', async () => {
      mockPrisma.schedulePrediction.findMany.mockResolvedValue([]);

      await getProjectPredictions('proj-1', { limit: 10 });

      expect(mockPrisma.schedulePrediction.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    });
  });

  describe('recordActualOutcome', () => {
    it('should update prediction with actual outcome', async () => {
      const predictedDate = new Date('2024-12-31');
      const actualDate = new Date('2025-01-03');

      mockPrisma.schedulePrediction.findUnique.mockResolvedValue({
        id: 'pred-1',
        predictedDate,
        confidenceLevel: 85,
      });

      mockPrisma.schedulePrediction.update.mockResolvedValue({});

      await recordActualOutcome('pred-1', actualDate);

      expect(mockPrisma.schedulePrediction.update).toHaveBeenCalledWith({
        where: { id: 'pred-1' },
        data: {
          actualDate,
          accuracy: expect.any(Number),
        },
      });

      const call = mockPrisma.schedulePrediction.update.mock.calls[0][0];
      expect(call.data.accuracy).toBeLessThan(100); // 3 days off
    });

    it('should calculate accuracy correctly', async () => {
      const predictedDate = new Date('2024-12-31');
      const actualDate = new Date('2024-12-31'); // Perfect prediction

      mockPrisma.schedulePrediction.findUnique.mockResolvedValue({
        id: 'pred-1',
        predictedDate,
      });

      mockPrisma.schedulePrediction.update.mockResolvedValue({});

      await recordActualOutcome('pred-1', actualDate);

      const call = mockPrisma.schedulePrediction.update.mock.calls[0][0];
      expect(call.data.accuracy).toBe(100);
    });

    it('should do nothing if prediction not found', async () => {
      mockPrisma.schedulePrediction.findUnique.mockResolvedValue(null);

      await recordActualOutcome('missing-pred', new Date());

      expect(mockPrisma.schedulePrediction.update).not.toHaveBeenCalled();
    });
  });

  describe('getWeatherImpactForecast', () => {
    it('should return placeholder when no API key', async () => {
      delete process.env.OPENWEATHERMAP_API_KEY;

      const forecast = await getWeatherImpactForecast(40.7128, -74.0060, 14);

      expect(forecast.forecastDays).toBe(14);
      expect(forecast.rainDays).toBeGreaterThanOrEqual(0);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      process.env.OPENWEATHERMAP_API_KEY = 'test-key';

      const forecast = await getWeatherImpactForecast(40.7128, -74.0060);

      expect(forecast.forecastDays).toBe(14);
      expect(forecast.estimatedImpactDays).toBeGreaterThanOrEqual(0);
    });

    it('should use default forecast days', async () => {
      const forecast = await getWeatherImpactForecast(40.7128, -74.0060);

      expect(forecast.forecastDays).toBe(14);
    });
  });

  describe('analyzeProjectRisks', () => {
    it('should analyze project risks', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ name: 'Test' });
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.schedule.findFirst.mockResolvedValue(null);

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify([
          {
            category: 'weather',
            description: 'Heavy rain expected',
            probability: 80,
            impactDays: 5,
            mitigation: 'Reschedule outdoor work',
          },
          {
            category: 'labor',
            description: 'Labor shortage',
            probability: 60,
            impactDays: 3,
            mitigation: 'Hire additional workers',
          },
        ]),
      });

      const risks = await analyzeProjectRisks('proj-1');

      expect(risks).toHaveLength(2);
      expect(risks[0].category).toBe('weather');
      expect(risks[1].category).toBe('labor');
    });

    it('should return empty array on error', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ name: 'Test' });
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.schedule.findFirst.mockResolvedValue(null);

      mockAbacusLLM.callAbacusLLM.mockRejectedValue(new Error('API error'));

      const risks = await analyzeProjectRisks('proj-1');

      expect(risks).toHaveLength(0);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle malformed response', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ name: 'Test' });
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.schedule.findFirst.mockResolvedValue(null);

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: 'not a json array',
      });

      const risks = await analyzeProjectRisks('proj-1');

      expect(risks).toHaveLength(0);
    });
  });

  describe('runFullSchedulePrediction', () => {
    it('should run complete prediction workflow', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test',
        locationLat: 40.7128,
        locationLon: -74.0060,
      });

      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.schedule.findFirst.mockResolvedValue(null);

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          predictedCompletionDate: '2024-12-31',
          confidenceLevel: 85,
          daysFromTarget: 5,
          riskFactors: [],
          weatherImpact: 2,
          laborImpact: 1,
          supplyImpact: 0,
          recommendation: 'Monitor weather',
          analysisDetails: 'Good progress',
        }),
      });

      mockPrisma.schedulePrediction.create.mockResolvedValue({ id: 'pred-1' });

      const result = await runFullSchedulePrediction('proj-1', new Date('2024-12-26'), 'Complete foundation');

      expect(result.predictionId).toBe('pred-1');
      expect(result.result.confidenceLevel).toBe(85);
      expect(result.risks).toBeDefined();
    });

    it('should use default target date if not provided', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        locationLat: null,
        locationLon: null,
      });

      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.schedule.findFirst.mockResolvedValue(null);

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          predictedCompletionDate: new Date().toISOString(),
          confidenceLevel: 50,
          daysFromTarget: 0,
          riskFactors: [],
          weatherImpact: 0,
          laborImpact: 0,
          supplyImpact: 0,
          recommendation: 'OK',
          analysisDetails: 'OK',
        }),
      });

      mockPrisma.schedulePrediction.create.mockResolvedValue({ id: 'pred-1' });

      const result = await runFullSchedulePrediction('proj-1');

      expect(result.predictionId).toBeDefined();
    });

    it('should skip weather forecast if no location', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        locationLat: null,
        locationLon: null,
      });

      mockPrisma.dailyReport.findMany.mockResolvedValue([]);
      mockPrisma.schedule.findFirst.mockResolvedValue(null);

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          predictedCompletionDate: '2024-12-31',
          confidenceLevel: 80,
          daysFromTarget: 0,
          riskFactors: [],
          weatherImpact: 0,
          laborImpact: 0,
          supplyImpact: 0,
          recommendation: 'OK',
          analysisDetails: 'OK',
        }),
      });

      mockPrisma.schedulePrediction.create.mockResolvedValue({ id: 'pred-1' });

      const result = await runFullSchedulePrediction('proj-1', new Date('2024-12-31'));

      expect(result.result.weatherImpact).toBe(0);
    });
  });
});
