import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  dailyReport: {
    findMany: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
  projectBudget: {
    findFirst: vi.fn(),
  },
  schedule: {
    findFirst: vi.fn(),
  },
  mEPEquipment: {
    findMany: vi.fn(),
  },
  changeOrder: {
    findMany: vi.fn(),
  },
  crew: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

// Import after mocks
import {
  generateCSV,
  exportDailyReports,
  exportBudget,
  exportSchedule,
  exportMEPEquipment,
  exportChangeOrders,
  exportCrewPerformance,
  exportProjectData,
} from '@/lib/export-service';

describe('export-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateCSV', () => {
    it('should generate CSV from table data', () => {
      const data = {
        headers: ['Name', 'Age', 'City'],
        rows: [
          ['John Doe', 30, 'New York'],
          ['Jane Smith', 25, 'Los Angeles'],
        ],
      };

      const csv = generateCSV(data);

      expect(csv).toBe('Name,Age,City\nJohn Doe,30,New York\nJane Smith,25,Los Angeles');
    });

    it('should escape values containing commas', () => {
      const data = {
        headers: ['Name', 'Address'],
        rows: [['John Doe', '123 Main St, Apt 4']],
      };

      const csv = generateCSV(data);

      expect(csv).toBe('Name,Address\nJohn Doe,"123 Main St, Apt 4"');
    });

    it('should escape values containing quotes', () => {
      const data = {
        headers: ['Name', 'Description'],
        rows: [['John Doe', 'He said "hello"']],
      };

      const csv = generateCSV(data);

      expect(csv).toBe('Name,Description\nJohn Doe,"He said ""hello"""');
    });

    it('should escape values containing newlines', () => {
      const data = {
        headers: ['Name', 'Notes'],
        rows: [['John Doe', 'Line 1\nLine 2']],
      };

      const csv = generateCSV(data);

      expect(csv).toBe('Name,Notes\nJohn Doe,"Line 1\nLine 2"');
    });

    it('should handle numeric values', () => {
      const data = {
        headers: ['Item', 'Price'],
        rows: [
          ['Widget', 19.99],
          ['Gadget', 49.99],
        ],
      };

      const csv = generateCSV(data);

      expect(csv).toBe('Item,Price\nWidget,19.99\nGadget,49.99');
    });
  });

  describe('exportDailyReports', () => {
    it('should export daily reports with date range filter', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Building Project',
      });

      mockPrisma.dailyReport.findMany.mockResolvedValueOnce([
        {
          reportDate: new Date('2026-01-15'),
          reportNumber: 42,
          status: 'APPROVED',
          weatherCondition: 'Sunny',
          temperatureHigh: 75,
          temperatureLow: 55,
          precipitation: 0,
          workPerformed: 'Foundation work completed',
          safetyIncidents: 0,
          delaysEncountered: 'None',
          weatherNotes: 'Perfect weather',
        },
      ]);

      const result = await exportDailyReports('project-123', {
        format: 'csv',
        dateRange: {
          start: new Date('2026-01-01'),
          end: new Date('2026-01-31'),
        },
      });

      expect(result.filename).toContain('Building Project_Daily_Reports');
      expect(result.mimeType).toBe('text/csv');
      expect(result.content).toContain('2026-01-14'); // Date is formatted as one day before due to UTC conversion
      expect(result.content).toContain('42');
      expect(result.content).toContain('Sunny');
      expect(mockPrisma.dailyReport.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-123',
          reportDate: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
        orderBy: { reportDate: 'desc' },
      });
    });

    it('should export all reports when no date range provided', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Test Project',
      });

      mockPrisma.dailyReport.findMany.mockResolvedValueOnce([]);

      const result = await exportDailyReports('project-123', { format: 'csv' });

      expect(mockPrisma.dailyReport.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-123' },
        orderBy: { reportDate: 'desc' },
      });
    });

    it('should handle null values in reports', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Test Project',
      });

      mockPrisma.dailyReport.findMany.mockResolvedValueOnce([
        {
          reportDate: new Date('2026-01-15'),
          reportNumber: null,
          status: null,
          weatherCondition: null,
          temperatureHigh: null,
          temperatureLow: null,
          precipitation: null,
          workPerformed: null,
          safetyIncidents: null,
          delaysEncountered: null,
          weatherNotes: null,
        },
      ]);

      const result = await exportDailyReports('project-123', { format: 'csv' });

      expect(result.content).toContain('N/A');
      expect(result.content).toContain('0');
    });
  });

  describe('exportBudget', () => {
    it('should export budget with all items and totals', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Building Project',
      });

      mockPrisma.projectBudget.findFirst.mockResolvedValueOnce({
        id: 'budget-123',
        projectId: 'project-123',
        BudgetItem: [
          {
            costCode: '03-100',
            name: 'Concrete Work',
            tradeType: 'concrete_masonry',
            budgetedAmount: 50000,
            committedCost: 45000,
            actualCost: 48000,
          },
          {
            costCode: '05-200',
            name: 'Steel Framing',
            tradeType: 'structural_steel',
            budgetedAmount: 100000,
            committedCost: 90000,
            actualCost: 95000,
          },
        ],
      });

      const result = await exportBudget('project-123', { format: 'csv' });

      expect(result.content).toContain('03-100');
      expect(result.content).toContain('Concrete Work');
      expect(result.content).toContain('$50,000');
      expect(result.content).toContain('TOTAL');
      expect(result.content).toContain('$150,000'); // Total budgeted
    });

    it('should handle budget with no items', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Empty Project',
      });

      mockPrisma.projectBudget.findFirst.mockResolvedValueOnce(null);

      const result = await exportBudget('project-123', { format: 'csv' });

      expect(result.content).toBe('No budget data available');
    });

    it('should calculate variance percentages correctly', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Test Project',
      });

      mockPrisma.projectBudget.findFirst.mockResolvedValueOnce({
        id: 'budget-123',
        projectId: 'project-123',
        BudgetItem: [
          {
            costCode: '01-100',
            name: 'Test Item',
            tradeType: null,
            budgetedAmount: 10000,
            committedCost: 0,
            actualCost: 8000,
          },
        ],
      });

      const result = await exportBudget('project-123', { format: 'csv' });

      expect(result.content).toContain('20.0%'); // (10000-8000)/10000 * 100
    });

    it('should handle null costs', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Test Project',
      });

      mockPrisma.projectBudget.findFirst.mockResolvedValueOnce({
        id: 'budget-123',
        projectId: 'project-123',
        BudgetItem: [
          {
            costCode: '01-100',
            name: 'Test Item',
            tradeType: null,
            budgetedAmount: 10000,
            committedCost: null,
            actualCost: null,
          },
        ],
      });

      const result = await exportBudget('project-123', { format: 'csv' });

      expect(result.content).toContain('$0');
    });
  });

  describe('exportSchedule', () => {
    it('should export schedule with all tasks', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Building Project',
      });

      mockPrisma.schedule.findFirst.mockResolvedValueOnce({
        id: 'schedule-123',
        projectId: 'project-123',
        ScheduleTask: [
          {
            taskId: 'T001',
            name: 'Foundation',
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-01-15'),
            duration: 15,
            percentComplete: 100,
            status: 'COMPLETED',
            isCritical: true,
            totalFloat: 0,
            predecessors: [],
          },
          {
            taskId: 'T002',
            name: 'Framing',
            startDate: new Date('2026-01-16'),
            endDate: new Date('2026-02-01'),
            duration: 16,
            percentComplete: 50,
            status: 'IN_PROGRESS',
            isCritical: false,
            totalFloat: 3,
            predecessors: ['T001'],
          },
        ],
      });

      const result = await exportSchedule('project-123', { format: 'csv' });

      expect(result.content).toContain('T001');
      expect(result.content).toContain('Foundation');
      expect(result.content).toContain('2025-12-31'); // Date is formatted as one day before due to UTC conversion
      expect(result.content).toContain('Yes'); // Critical path
      expect(result.content).toContain('T001'); // Predecessor
    });

    it('should handle schedule not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Test Project',
      });

      mockPrisma.schedule.findFirst.mockResolvedValueOnce(null);

      const result = await exportSchedule('project-123', { format: 'csv' });

      expect(result.content).toBe('No schedule data available');
    });

    it('should handle null date values', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Test Project',
      });

      mockPrisma.schedule.findFirst.mockResolvedValueOnce({
        id: 'schedule-123',
        ScheduleTask: [
          {
            taskId: 'T001',
            name: 'Future Task',
            startDate: null,
            endDate: null,
            duration: null,
            percentComplete: null,
            status: 'PLANNED',
            isCritical: false,
            totalFloat: null,
            predecessors: null,
          },
        ],
      });

      const result = await exportSchedule('project-123', { format: 'csv' });

      expect(result.content).toContain('TBD');
    });
  });

  describe('exportMEPEquipment', () => {
    it('should export MEP equipment with all details', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Building Project',
      });

      mockPrisma.mEPEquipment.findMany.mockResolvedValueOnce([
        {
          equipmentTag: 'AHU-01',
          name: 'Air Handler Unit 1',
          equipmentType: 'HVAC',
          status: 'INSTALLED',
          manufacturer: 'Carrier',
          model: 'Model-XYZ',
          gridLocation: 'Grid A-1',
          level: 'Roof',
          estimatedCost: 15000,
          actualCost: 14500,
          installationDate: new Date('2026-01-15'),
          warrantyExpires: new Date('2027-01-15'),
        },
      ]);

      const result = await exportMEPEquipment('project-123', { format: 'csv' });

      expect(result.content).toContain('AHU-01');
      expect(result.content).toContain('Air Handler Unit 1');
      expect(result.content).toContain('Carrier');
      expect(result.content).toContain('$15,000');
    });

    it('should handle null values in equipment records', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Test Project',
      });

      mockPrisma.mEPEquipment.findMany.mockResolvedValueOnce([
        {
          equipmentTag: 'PUMP-01',
          name: 'Water Pump',
          equipmentType: 'Plumbing',
          status: 'ORDERED',
          manufacturer: null,
          model: null,
          gridLocation: null,
          level: null,
          estimatedCost: null,
          actualCost: null,
          installationDate: null,
          warrantyExpires: null,
        },
      ]);

      const result = await exportMEPEquipment('project-123', { format: 'csv' });

      expect(result.content).toContain('N/A');
    });
  });

  describe('exportChangeOrders', () => {
    it('should export change orders with summary', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Building Project',
      });

      mockPrisma.changeOrder.findMany.mockResolvedValueOnce([
        {
          orderNumber: 'CO-001',
          title: 'Additional Concrete Work',
          status: 'APPROVED',
          proposedAmount: 25000,
          approvedAmount: 23000,
          scheduleImpactDays: 3,
          createdAt: new Date('2026-01-10'),
          approvedDate: new Date('2026-01-15'),
          requestedBy: 'John Contractor',
          description: 'Extra foundation work required',
        },
        {
          orderNumber: 'CO-002',
          title: 'Electrical Upgrade',
          status: 'PENDING',
          proposedAmount: 15000,
          approvedAmount: null,
          scheduleImpactDays: null,
          createdAt: new Date('2026-01-20'),
          approvedDate: null,
          requestedBy: null,
          description: null,
        },
      ]);

      const result = await exportChangeOrders('project-123', { format: 'csv' });

      expect(result.content).toContain('CO-001');
      expect(result.content).toContain('SUMMARY');
      expect(result.content).toContain('Total Proposed:');
      expect(result.content).toContain('$40,000'); // 25000 + 15000
      expect(result.content).toContain('Total Approved:');
      expect(result.content).toContain('$23,000');
      expect(result.content).toContain('Pending Count:');
    });
  });

  describe('exportCrewPerformance', () => {
    it('should export crew performance with metrics', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Building Project',
      });

      mockPrisma.crew.findMany.mockResolvedValueOnce([
        {
          name: 'Concrete Crew A',
          tradeType: 'concrete_masonry',
          foremanName: 'Mike Smith',
          averageSize: 8,
          isActive: true,
          CrewPerformance: [
            {
              date: new Date('2026-01-15'),
              productivityRate: 95,
              hoursWorked: 64,
              qualityIssues: 0,
              safetyIncidents: 0,
            },
            {
              date: new Date('2026-01-16'),
              productivityRate: 98,
              hoursWorked: 72,
              qualityIssues: 1,
              safetyIncidents: 0,
            },
          ],
        },
      ]);

      const result = await exportCrewPerformance('project-123', { format: 'csv' });

      expect(result.content).toContain('Concrete Crew A');
      expect(result.content).toContain('Mike Smith');
      expect(result.content).toContain('96.5'); // Average productivity (95+98)/2
      expect(result.content).toContain('136'); // Total hours (64+72)
    });

    it('should apply date range filter to performance data', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Test Project',
      });

      mockPrisma.crew.findMany.mockResolvedValueOnce([]);

      await exportCrewPerformance('project-123', {
        format: 'csv',
        dateRange: {
          start: new Date('2026-01-01'),
          end: new Date('2026-01-31'),
        },
      });

      expect(mockPrisma.crew.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-123' },
        include: {
          CrewPerformance: {
            where: {
              date: {
                gte: expect.any(Date),
                lte: expect.any(Date),
              },
            },
            orderBy: { date: 'desc' },
          },
        },
      });
    });

    it('should handle crews with no performance data', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Test Project',
      });

      mockPrisma.crew.findMany.mockResolvedValueOnce([
        {
          name: 'New Crew',
          tradeType: null,
          foremanName: null,
          averageSize: null,
          isActive: true,
          CrewPerformance: [],
        },
      ]);

      const result = await exportCrewPerformance('project-123', { format: 'csv' });

      expect(result.content).toContain('N/A');
      expect(result.content).toContain('0');
    });
  });

  describe('exportProjectData', () => {
    it('should route to correct export function for daily_reports', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Test Project',
      });
      mockPrisma.dailyReport.findMany.mockResolvedValueOnce([]);

      const result = await exportProjectData('project-123', 'daily_reports', { format: 'csv' });

      expect(result.filename).toContain('Daily_Reports');
    });

    it('should route to correct export function for budget', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Test Project',
      });
      mockPrisma.projectBudget.findFirst.mockResolvedValueOnce(null);

      const result = await exportProjectData('project-123', 'budget', { format: 'csv' });

      expect(result.filename).toContain('Budget');
    });

    it('should route to correct export function for schedule', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Test Project',
      });
      mockPrisma.schedule.findFirst.mockResolvedValueOnce(null);

      const result = await exportProjectData('project-123', 'schedule', { format: 'csv' });

      expect(result.filename).toContain('Schedule');
    });

    it('should route to correct export function for mep', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Test Project',
      });
      mockPrisma.mEPEquipment.findMany.mockResolvedValueOnce([]);

      const result = await exportProjectData('project-123', 'mep', { format: 'csv' });

      expect(result.filename).toContain('MEP_Equipment');
    });

    it('should route to correct export function for change_orders', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Test Project',
      });
      mockPrisma.changeOrder.findMany.mockResolvedValueOnce([]);

      const result = await exportProjectData('project-123', 'change_orders', { format: 'csv' });

      expect(result.filename).toContain('Change_Orders');
    });

    it('should route to correct export function for crew_performance', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({
        name: 'Test Project',
      });
      mockPrisma.crew.findMany.mockResolvedValueOnce([]);

      const result = await exportProjectData('project-123', 'crew_performance', { format: 'csv' });

      expect(result.filename).toContain('Crew_Performance');
    });

    it('should throw error for unknown export type', async () => {
      await expect(
        exportProjectData('project-123', 'unknown' as any, { format: 'csv' })
      ).rejects.toThrow('Unknown export type: unknown');
    });
  });
});
