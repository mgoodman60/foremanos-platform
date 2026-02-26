import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateDailyReportDOCX,
  formatDailyReportForExport,
  type DailyReportData,
} from '@/lib/daily-report-docx-generator';

// Mock PizZip
const mockPizZipInstance = {
  file: vi.fn().mockReturnThis(),
  generate: vi.fn().mockReturnValue(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), // ZIP header
};

vi.mock('pizzip', () => ({
  default: vi.fn(() => mockPizZipInstance),
}));

describe('daily-report-docx-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockReportData: DailyReportData = {
    project: {
      name: 'Test Construction Project',
      slug: 'test-project',
      address: '123 Build St',
      clientName: 'ACME Corp',
    },
    report: {
      id: 'report-1',
      reportNumber: 42,
      reportDate: '2024-01-15T00:00:00Z',
      status: 'APPROVED',
      createdBy: 'John Foreman',
      submittedAt: '2024-01-15T17:00:00Z',
      approvedAt: '2024-01-16T09:00:00Z',
      approvedBy: 'Jane Manager',
    },
    weather: {
      condition: 'Partly Cloudy',
      temperatureHigh: 75,
      temperatureLow: 55,
      humidity: 65,
      precipitation: 0,
      windSpeed: 10,
      notes: 'Good weather for outdoor work',
    },
    workSummary: {
      workPerformed: 'Completed foundation formwork\nPoured concrete for footings',
      workPlanned: 'Strip forms tomorrow\nStart vertical rebar',
      delaysEncountered: 'Concrete delivery delayed 2 hours',
      delayHours: 2,
      delayReason: 'Traffic on highway',
    },
    safety: {
      incidents: 0,
      notes: 'Safety meeting conducted. All PPE verified.',
    },
    labor: [
      {
        trade: 'Concrete',
        subcontractor: 'ABC Concrete Inc',
        headcount: 8,
        hoursWorked: 64,
        hourlyRate: 45,
        notes: 'Pour crew',
      },
      {
        trade: 'General Labor',
        headcount: 4,
        hoursWorked: 32,
        notes: 'Site cleanup',
      },
    ],
    equipment: [
      {
        name: 'Concrete Pump',
        hours: 6,
        status: 'Operating',
        notes: 'No issues',
      },
      {
        name: 'Excavator',
        hours: 4,
        status: 'Standby',
      },
    ],
    materials: [
      {
        description: '3000 PSI Concrete',
        quantity: '25 CY',
        supplier: 'Ready Mix Co',
      },
      {
        description: '#4 Rebar',
        quantity: '500 LF',
      },
    ],
    visitors: [
      {
        name: 'Inspector Smith',
        company: 'City Building Dept',
        timeIn: '10:00 AM',
        timeOut: '10:30 AM',
      },
    ],
    progress: [
      {
        area: 'Foundation',
        activity: 'Footing formwork',
        percentComplete: 100,
        notes: 'Ready for pour',
      },
      {
        area: 'Site Work',
        activity: 'Grading',
        percentComplete: 75,
      },
    ],
    photos: [
      {
        url: 'https://example.com/photo1.jpg',
        caption: 'Foundation pour',
      },
    ],
    exportedAt: '2024-01-16T12:00:00Z',
  };

  describe('generateDailyReportDOCX', () => {
    it('should generate a DOCX blob with all sections', async () => {
      const result = await generateDailyReportDOCX(mockReportData);

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(mockPizZipInstance.file).toHaveBeenCalledWith('[Content_Types].xml', expect.any(String));
      expect(mockPizZipInstance.file).toHaveBeenCalledWith('_rels/.rels', expect.any(String));
      expect(mockPizZipInstance.file).toHaveBeenCalledWith('word/document.xml', expect.any(String));
      expect(mockPizZipInstance.file).toHaveBeenCalledWith('word/_rels/document.xml.rels', expect.any(String));
      expect(mockPizZipInstance.file).toHaveBeenCalledWith('word/styles.xml', expect.any(String));
      expect(mockPizZipInstance.generate).toHaveBeenCalledWith({ type: 'uint8array' });
    });

    it('should include report header with project name and report number', async () => {
      await generateDailyReportDOCX(mockReportData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall).toBeDefined();
      expect(documentXmlCall![1]).toContain('DAILY FIELD REPORT #42');
      expect(documentXmlCall![1]).toContain('Test Construction Project');
    });

    it('should include weather section with all conditions', async () => {
      await generateDailyReportDOCX(mockReportData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('WEATHER CONDITIONS');
      expect(documentXmlCall![1]).toContain('Partly Cloudy');
      expect(documentXmlCall![1]).toContain('55°F - 75°F');
      expect(documentXmlCall![1]).toContain('65%');
      expect(documentXmlCall![1]).toContain('10 mph');
    });

    it('should include work summary section', async () => {
      await generateDailyReportDOCX(mockReportData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('WORK SUMMARY');
      expect(documentXmlCall![1]).toContain('Completed foundation formwork');
      expect(documentXmlCall![1]).toContain('Strip forms tomorrow');
      expect(documentXmlCall![1]).toContain('Concrete delivery delayed');
    });

    it('should include safety section', async () => {
      await generateDailyReportDOCX(mockReportData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('SAFETY');
      expect(documentXmlCall![1]).toContain('Incidents: 0');
      expect(documentXmlCall![1]).toContain('Safety meeting conducted');
    });

    it('should include labor section with totals', async () => {
      await generateDailyReportDOCX(mockReportData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('LABOR');
      expect(documentXmlCall![1]).toContain('12 workers'); // 8 + 4
      expect(documentXmlCall![1]).toContain('96 total hours'); // 64 + 32
      expect(documentXmlCall![1]).toContain('Concrete');
      expect(documentXmlCall![1]).toContain('ABC Concrete Inc');
      expect(documentXmlCall![1]).toContain('$45/hr');
    });

    it('should include equipment section', async () => {
      await generateDailyReportDOCX(mockReportData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('EQUIPMENT ON SITE');
      expect(documentXmlCall![1]).toContain('Concrete Pump');
      expect(documentXmlCall![1]).toContain('Excavator');
      expect(documentXmlCall![1]).toContain('Operating');
    });

    it('should include materials section', async () => {
      await generateDailyReportDOCX(mockReportData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('MATERIALS RECEIVED');
      expect(documentXmlCall![1]).toContain('3000 PSI Concrete');
      expect(documentXmlCall![1]).toContain('25 CY');
      expect(documentXmlCall![1]).toContain('Ready Mix Co');
    });

    it('should include visitors section', async () => {
      await generateDailyReportDOCX(mockReportData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('VISITORS');
      expect(documentXmlCall![1]).toContain('Inspector Smith');
      expect(documentXmlCall![1]).toContain('City Building Dept');
      expect(documentXmlCall![1]).toContain('10:00 AM');
    });

    it('should include progress section', async () => {
      await generateDailyReportDOCX(mockReportData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('PROGRESS UPDATE');
      expect(documentXmlCall![1]).toContain('Foundation');
      expect(documentXmlCall![1]).toContain('Footing formwork');
      expect(documentXmlCall![1]).toContain('100%');
    });

    it('should include signatures section', async () => {
      await generateDailyReportDOCX(mockReportData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('SIGNATURES');
      expect(documentXmlCall![1]).toContain('Prepared By: John Foreman');
      expect(documentXmlCall![1]).toContain('Superintendent');
      expect(documentXmlCall![1]).toContain('Project Manager');
    });

    it('should escape XML special characters', async () => {
      const dataWithSpecialChars: DailyReportData = {
        ...mockReportData,
        workSummary: {
          workPerformed: 'Test & verify <safety> requirements',
        },
      };

      await generateDailyReportDOCX(dataWithSpecialChars);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('&amp;');
      expect(documentXmlCall![1]).toContain('&lt;');
      expect(documentXmlCall![1]).toContain('&gt;');
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalData: DailyReportData = {
        project: {
          name: 'Minimal Project',
          slug: 'minimal',
        },
        report: {
          id: 'report-1',
          reportNumber: 1,
          reportDate: '2024-01-15T00:00:00Z',
          status: 'DRAFT',
        },
        weather: {},
        workSummary: {},
        safety: {
          incidents: 0,
        },
        labor: [],
        equipment: [],
        materials: [],
        visitors: [],
        progress: [],
        photos: [],
        exportedAt: '2024-01-15T12:00:00Z',
      };

      const result = await generateDailyReportDOCX(minimalData);

      expect(result).toBeInstanceOf(Blob);
    });

    it('should format date correctly', async () => {
      await generateDailyReportDOCX(mockReportData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      // Should contain formatted date with day of week
      expect(documentXmlCall![1]).toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/);
    });

    it('should include project address when provided', async () => {
      await generateDailyReportDOCX(mockReportData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('123 Build St');
    });

    it('should omit empty sections', async () => {
      const dataWithoutLabor: DailyReportData = {
        ...mockReportData,
        labor: [],
      };

      await generateDailyReportDOCX(dataWithoutLabor);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      // Should not have LABOR section header if no labor entries
      const laborSectionCount = (documentXmlCall![1].match(/=== LABOR/g) || []).length;
      expect(laborSectionCount).toBe(0);
    });
  });

  describe('formatDailyReportForExport', () => {
    const mockReport: any = {
      id: 'report-1',
      reportNumber: 42,
      reportDate: new Date('2024-01-15'),
      status: 'APPROVED',
      createdByUser: {
        username: 'jforeman',
        name: 'John Foreman',
      },
      submittedAt: new Date('2024-01-15T17:00:00Z'),
      approvedAt: new Date('2024-01-16T09:00:00Z'),
      approvedBy: 'Jane Manager',
      weatherCondition: 'Sunny',
      temperatureHigh: 80,
      temperatureLow: 60,
      humidity: 50,
      precipitation: 0,
      windSpeed: 5,
      weatherNotes: 'Perfect weather',
      workPerformed: 'Completed work',
      workPlanned: 'Next steps',
      delaysEncountered: 'None',
      delayHours: 0,
      delayReason: null,
      safetyIncidents: 0,
      safetyNotes: 'All clear',
      materialsReceived: [
        {
          description: 'Lumber',
          quantity: 100,
          supplier: 'Lumber Co',
        },
      ],
      visitors: [
        {
          name: 'Inspector',
          company: 'City',
          timeIn: '10:00',
          timeOut: '10:30',
        },
      ],
    };

    const mockProject = {
      name: 'Test Project',
      slug: 'test-project',
      address: '123 Main St',
      clientName: 'Client Corp',
    };

    const mockLabor = [
      {
        trade: 'Concrete',
        subcontractor: 'ABC Concrete',
        headcount: 5,
        hoursWorked: 40,
        hourlyRate: 50,
        notes: 'Pour crew',
      },
    ];

    const mockEquipment = [
      {
        equipmentName: 'Crane',
        hoursUsed: 8,
        status: 'Operating',
        notes: 'Tower crane',
      },
    ];

    const mockProgress = [
      {
        area: 'Foundation',
        activity: 'Excavation',
        percentComplete: 100,
        notes: 'Complete',
      },
    ];

    it('should format report data correctly', () => {
      const result = formatDailyReportForExport(
        mockReport,
        mockProject,
        mockLabor,
        mockEquipment,
        mockProgress
      );

      expect(result.report.reportNumber).toBe(42);
      expect(result.report.status).toBe('APPROVED');
      expect(result.report.createdBy).toBe('jforeman');
      expect(result.project.name).toBe('Test Project');
    });

    it('should format weather data', () => {
      const result = formatDailyReportForExport(
        mockReport,
        mockProject,
        mockLabor,
        mockEquipment,
        mockProgress
      );

      expect(result.weather.condition).toBe('Sunny');
      expect(result.weather.temperatureHigh).toBe(80);
      expect(result.weather.temperatureLow).toBe(60);
      expect(result.weather.humidity).toBe(50);
    });

    it('should format labor entries', () => {
      const result = formatDailyReportForExport(
        mockReport,
        mockProject,
        mockLabor,
        mockEquipment,
        mockProgress
      );

      expect(result.labor).toHaveLength(1);
      expect(result.labor[0].trade).toBe('Concrete');
      expect(result.labor[0].headcount).toBe(5);
      expect(result.labor[0].hoursWorked).toBe(40);
      expect(result.labor[0].hourlyRate).toBe(50);
    });

    it('should format equipment entries', () => {
      const result = formatDailyReportForExport(
        mockReport,
        mockProject,
        mockLabor,
        mockEquipment,
        mockProgress
      );

      expect(result.equipment).toHaveLength(1);
      expect(result.equipment[0].name).toBe('Crane');
      expect(result.equipment[0].hours).toBe(8);
      expect(result.equipment[0].status).toBe('Operating');
    });

    it('should format progress entries', () => {
      const result = formatDailyReportForExport(
        mockReport,
        mockProject,
        mockLabor,
        mockEquipment,
        mockProgress
      );

      expect(result.progress).toHaveLength(1);
      expect(result.progress[0].area).toBe('Foundation');
      expect(result.progress[0].activity).toBe('Excavation');
      expect(result.progress[0].percentComplete).toBe(100);
    });

    it('should handle missing createdByUser', () => {
      const reportWithoutUser = {
        ...mockReport,
        createdByUser: undefined,
      };

      const result = formatDailyReportForExport(
        reportWithoutUser,
        mockProject,
        [],
        [],
        []
      );

      expect(result.report.createdBy).toBeUndefined();
    });

    it('should use equipment.name fallback', () => {
      const equipmentWithNameOnly = [
        {
          name: 'Forklift',
          hours: 6,
          status: 'Idle',
        },
      ];

      const result = formatDailyReportForExport(
        mockReport,
        mockProject,
        [],
        equipmentWithNameOnly,
        []
      );

      expect(result.equipment[0].name).toBe('Forklift');
    });

    it('should use progress.location fallback for area', () => {
      const progressWithLocation = [
        {
          location: 'Building A',
          activity: 'Framing',
          percentComplete: 50,
        },
      ];

      const result = formatDailyReportForExport(
        mockReport,
        mockProject,
        [],
        [],
        progressWithLocation
      );

      expect(result.progress[0].area).toBe('Building A');
    });

    it('should default labor trade to General when missing', () => {
      const laborWithoutTrade = [
        {
          headcount: 3,
          hoursWorked: 24,
        },
      ];

      const result = formatDailyReportForExport(
        mockReport,
        mockProject,
        laborWithoutTrade,
        [],
        []
      );

      expect(result.labor[0].trade).toBe('General');
    });

    it('should convert materialsReceived quantity to string', () => {
      const result = formatDailyReportForExport(
        mockReport,
        mockProject,
        [],
        [],
        []
      );

      expect(result.materials[0].quantity).toBe('100');
      expect(typeof result.materials[0].quantity).toBe('string');
    });

    it('should handle empty arrays', () => {
      const result = formatDailyReportForExport(
        mockReport,
        mockProject,
        [],
        [],
        []
      );

      expect(result.labor).toHaveLength(0);
      expect(result.equipment).toHaveLength(0);
      expect(result.progress).toHaveLength(0);
      expect(result.materials).toHaveLength(1); // From mockReport.materialsReceived
    });
  });
});
