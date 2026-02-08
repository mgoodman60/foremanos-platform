/**
 * Tests for SMS Daily Report Service (Phase 5)
 * Tests parseSMSToReportFields(), aggregateSMSMessages(), formatDailySummary(), lookupUserByPhone()
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  sMSMapping: { findFirst: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  createScopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import {
  parseSMSToReportFields,
  aggregateSMSMessages,
  formatDailySummary,
  lookupUserByPhone,
  type DailyReportFields,
} from '@/lib/sms-daily-report-service';

describe('parseSMSToReportFields', () => {
  it('should extract crew size from various formats', () => {
    expect(parseSMSToReportFields('6 guys on site').crewSize).toBe(6);
    expect(parseSMSToReportFields('4 workers today').crewSize).toBe(4);
    expect(parseSMSToReportFields('8 crew members').crewSize).toBe(8);
    expect(parseSMSToReportFields('3 people working').crewSize).toBe(3);
    expect(parseSMSToReportFields('5 men on the job').crewSize).toBe(5);
  });

  it('should parse "Started framing second floor. 6 guys on site" correctly', () => {
    const result = parseSMSToReportFields('Started framing second floor. 6 guys on site');

    expect(result.crewSize).toBe(6);
    expect(result.workPerformed).toContain('framing');
  });

  it('should detect equipment keywords', () => {
    const result = parseSMSToReportFields('Crane running all day');

    expect(result.equipment).toContain('crane');
    expect(result.workPerformed).toContain('Crane running all day');
  });

  it('should detect materials from delivery messages', () => {
    const result = parseSMSToReportFields('Delivery of lumber at 9am');

    expect(result.materials).toContain('lumber');
    expect(result.workPerformed).toBe('Delivery of lumber at 9am');
  });

  it('should parse delay hours and detect delay keywords', () => {
    const result = parseSMSToReportFields('Rain started at 2pm, lost about 2 hours');

    expect(result.delays).toBeTruthy();
    expect(result.delayHours).toBe(2);
    expect(result.workPerformed).toContain('Rain');
  });

  it('should return empty/partial fields for empty message', () => {
    const result = parseSMSToReportFields('');

    expect(result).toEqual({});
  });

  it('should detect safety incidents', () => {
    const result = parseSMSToReportFields('Injury on site, first aid administered');

    expect(result.safety).toBeTruthy();
    expect(result.safety).toContain('Injury');
  });

  it('should parse multiple keywords in one message correctly', () => {
    const result = parseSMSToReportFields(
      'Excavator and crane on site. Delivered concrete and rebar. 8 crew working. Rain delay lost 3 hours.'
    );

    expect(result.crewSize).toBe(8);
    expect(result.equipment).toEqual(expect.arrayContaining(['excavator', 'crane']));
    expect(result.materials).toEqual(expect.arrayContaining(['concrete', 'rebar']));
    expect(result.delays).toBeTruthy();
    expect(result.delayHours).toBe(3);
  });

  it('should detect various equipment types', () => {
    const messages = [
      'Excavator digging foundation',
      'Loader moving materials',
      'Forklift on site',
      'Boom lift for ceiling work',
      'Concrete truck arriving at 10am',
    ];

    messages.forEach(msg => {
      const result = parseSMSToReportFields(msg);
      expect(result.equipment).toBeDefined();
      expect(result.equipment!.length).toBeGreaterThan(0);
    });
  });

  it('should detect various materials', () => {
    const messages = [
      'Steel beams delivered',
      'Drywall installation started',
      'Pipe and conduit on site',
      'Brick and block arrived',
      'Roofing materials delivered',
    ];

    messages.forEach(msg => {
      const result = parseSMSToReportFields(msg);
      expect(result.materials).toBeDefined();
      expect(result.materials!.length).toBeGreaterThan(0);
    });
  });

  it('should detect delay patterns', () => {
    const delayMessages = [
      'Delayed by rain',
      'Work stopped due to storm',
      'Waited for materials',
      'Shutdown for safety',
      'Halted work temporarily',
    ];

    delayMessages.forEach(msg => {
      const result = parseSMSToReportFields(msg);
      expect(result.delays).toBeTruthy();
    });
  });

  it('should detect safety patterns', () => {
    const safetyMessages = [
      'Minor injury reported',
      'Near miss incident',
      'Unsafe condition found',
      'First aid administered',
      'Hazard identified',
    ];

    safetyMessages.forEach(msg => {
      const result = parseSMSToReportFields(msg);
      expect(result.safety).toBeTruthy();
    });
  });

  it('should extract delay hours with different formats', () => {
    // Pattern matches: "lost|delayed|stopped" + optional "about" + number + "hours|hrs"
    // Note: The keyword must be immediately before the number
    expect(parseSMSToReportFields('Rain delay, lost 3 hours to weather').delayHours).toBe(3);
    expect(parseSMSToReportFields('Delayed about 2.5 hrs').delayHours).toBe(2.5);
    expect(parseSMSToReportFields('stopped 4 hours').delayHours).toBe(4);
  });

  it('should handle case-insensitive matching', () => {
    const result1 = parseSMSToReportFields('CRANE AND EXCAVATOR ON SITE');
    const result2 = parseSMSToReportFields('crane and excavator on site');

    expect(result1.equipment).toEqual(result2.equipment);
  });

  it('should set workPerformed to the full message text', () => {
    const message = 'Completed foundation work today';
    const result = parseSMSToReportFields(message);

    expect(result.workPerformed).toBe(message);
  });
});

describe('aggregateSMSMessages', () => {
  it('should combine multiple messages chronologically', () => {
    const messages = [
      { text: 'Started framing', timestamp: new Date('2026-02-08T08:00:00Z') },
      { text: 'Lunch break', timestamp: new Date('2026-02-08T12:00:00Z') },
      { text: 'Finished framing second floor', timestamp: new Date('2026-02-08T16:00:00Z') },
    ];

    const result = aggregateSMSMessages(messages);

    expect(result.workPerformed).toContain('Started framing');
    expect(result.workPerformed).toContain('Lunch break');
    expect(result.workPerformed).toContain('Finished framing');
    // Check chronological order with separator
    const parts = result.workPerformed.split(' | ');
    expect(parts[0]).toContain('Started framing');
    expect(parts[2]).toContain('Finished framing');
  });

  it('should take max crew size across messages', () => {
    const messages = [
      { text: '4 guys in morning', timestamp: new Date('2026-02-08T08:00:00Z') },
      { text: '8 crew after lunch', timestamp: new Date('2026-02-08T13:00:00Z') },
      { text: '6 workers finishing', timestamp: new Date('2026-02-08T16:00:00Z') },
    ];

    const result = aggregateSMSMessages(messages);

    expect(result.crewSize).toBe(8); // Maximum crew size
  });

  it('should deduplicate equipment and materials', () => {
    const messages = [
      { text: 'Crane on site', timestamp: new Date('2026-02-08T08:00:00Z') },
      { text: 'Using crane and excavator', timestamp: new Date('2026-02-08T10:00:00Z') },
      { text: 'Crane still running', timestamp: new Date('2026-02-08T14:00:00Z') },
    ];

    const result = aggregateSMSMessages(messages);

    expect(result.equipment).toContain('crane');
    expect(result.equipment).toContain('excavator');
    expect(result.equipment.filter(e => e === 'crane').length).toBe(1); // No duplicates
  });

  it('should concatenate delay text from multiple messages', () => {
    const messages = [
      { text: 'Rain delay in morning', timestamp: new Date('2026-02-08T09:00:00Z') },
      { text: 'Stopped work, lost 2 hours', timestamp: new Date('2026-02-08T11:00:00Z') },
      { text: 'Weather cleared up', timestamp: new Date('2026-02-08T13:00:00Z') },
    ];

    const result = aggregateSMSMessages(messages);

    expect(result.delays).toContain('Rain delay');
    expect(result.delays).toContain('Stopped work');
    expect(result.delayHours).toBe(2);
  });

  it('should handle empty messages array', () => {
    const result = aggregateSMSMessages([]);

    expect(result).toEqual({
      workPerformed: '',
      crewSize: 0,
      equipment: [],
      materials: [],
      delays: '',
      delayHours: 0,
      safety: '',
    });
  });

  it('should aggregate safety notes from multiple messages', () => {
    const messages = [
      { text: 'Near miss with forklift', timestamp: new Date('2026-02-08T10:00:00Z') },
      { text: 'Minor injury reported', timestamp: new Date('2026-02-08T14:00:00Z') },
    ];

    const result = aggregateSMSMessages(messages);

    expect(result.safety).toContain('Near miss');
    expect(result.safety).toContain('injury');
  });

  it('should sort messages by timestamp before aggregation', () => {
    const messages = [
      { text: 'Third message', timestamp: new Date('2026-02-08T16:00:00Z') },
      { text: 'First message', timestamp: new Date('2026-02-08T08:00:00Z') },
      { text: 'Second message', timestamp: new Date('2026-02-08T12:00:00Z') },
    ];

    const result = aggregateSMSMessages(messages);

    const parts = result.workPerformed.split(' | ');
    expect(parts[0]).toContain('First message');
    expect(parts[1]).toContain('Second message');
    expect(parts[2]).toContain('Third message');
  });

  it('should collect all unique materials across messages', () => {
    const messages = [
      { text: 'Lumber delivered', timestamp: new Date('2026-02-08T08:00:00Z') },
      { text: 'Concrete and rebar on site', timestamp: new Date('2026-02-08T10:00:00Z') },
      { text: 'More lumber arrived', timestamp: new Date('2026-02-08T14:00:00Z') },
    ];

    const result = aggregateSMSMessages(messages);

    expect(result.materials).toContain('lumber');
    expect(result.materials).toContain('concrete');
    expect(result.materials).toContain('rebar');
    expect(result.materials.filter(m => m === 'lumber').length).toBe(1);
  });

  it('should handle messages with mixed content types', () => {
    const messages = [
      { text: '6 guys started work', timestamp: new Date('2026-02-08T08:00:00Z') },
      { text: 'Crane and excavator running', timestamp: new Date('2026-02-08T09:00:00Z') },
      { text: 'Steel beams delivered', timestamp: new Date('2026-02-08T10:00:00Z') },
      { text: 'Rain delay, lost 1 hour', timestamp: new Date('2026-02-08T14:00:00Z') },
    ];

    const result = aggregateSMSMessages(messages);

    expect(result.crewSize).toBe(6);
    expect(result.equipment).toEqual(expect.arrayContaining(['crane', 'excavator']));
    expect(result.materials).toContain('steel');
    expect(result.delayHours).toBe(1);
    expect(result.workPerformed.split(' | ')).toHaveLength(4);
  });
});

describe('formatDailySummary', () => {
  it('should produce readable summary text with all fields', () => {
    const fields: DailyReportFields = {
      workPerformed: 'Completed foundation work and started framing',
      crewSize: 8,
      equipment: ['crane', 'excavator'],
      materials: ['lumber', 'concrete'],
      delays: 'Rain delay',
      delayHours: 2,
      safety: 'All clear',
    };

    const summary = formatDailySummary(fields);

    expect(summary).toContain('Completed foundation work');
    expect(summary).toContain('8 crew');
    expect(summary).toContain('crane');
    expect(summary).toContain('excavator');
    expect(summary).toContain('lumber');
    expect(summary).toContain('concrete');
    expect(summary).toContain('delay: 2hr');
    expect(summary).toContain('SAFETY NOTE');
  });

  it('should handle empty/missing fields gracefully', () => {
    const fields: DailyReportFields = {
      workPerformed: '',
      crewSize: 0,
      equipment: [],
      materials: [],
      delays: '',
      delayHours: 0,
      safety: '',
    };

    const summary = formatDailySummary(fields);

    expect(summary).toContain("Today's summary:");
    expect(summary).toContain('Reply OK');
  });

  it('should truncate long workPerformed text', () => {
    const longText = 'A'.repeat(150);
    const fields: DailyReportFields = {
      workPerformed: longText,
      crewSize: 0,
      equipment: [],
      materials: [],
      delays: '',
      delayHours: 0,
      safety: '',
    };

    const summary = formatDailySummary(fields);

    expect(summary).toContain('...');
    expect(summary.indexOf('...')).toBeLessThan(150);
  });

  it('should format equipment list correctly', () => {
    const fields: DailyReportFields = {
      workPerformed: 'Work done',
      crewSize: 5,
      equipment: ['crane', 'excavator', 'loader'],
      materials: [],
      delays: '',
      delayHours: 0,
      safety: '',
    };

    const summary = formatDailySummary(fields);

    expect(summary).toContain('crane, excavator, loader');
  });

  it('should format materials list correctly', () => {
    const fields: DailyReportFields = {
      workPerformed: 'Work done',
      crewSize: 5,
      equipment: [],
      materials: ['lumber', 'concrete', 'rebar'],
      delays: '',
      delayHours: 0,
      safety: '',
    };

    const summary = formatDailySummary(fields);

    expect(summary).toContain('materials: lumber, concrete, rebar');
  });

  it('should show delay hours or ? if not specified', () => {
    const fields1: DailyReportFields = {
      workPerformed: 'Work',
      crewSize: 0,
      equipment: [],
      materials: [],
      delays: 'Weather delay',
      delayHours: 3,
      safety: '',
    };

    const fields2: DailyReportFields = {
      workPerformed: 'Work',
      crewSize: 0,
      equipment: [],
      materials: [],
      delays: 'Weather delay',
      delayHours: 0,
      safety: '',
    };

    const summary1 = formatDailySummary(fields1);
    const summary2 = formatDailySummary(fields2);

    expect(summary1).toContain('delay: 3hr');
    expect(summary2).toContain('delay: ?hr');
  });

  it('should include confirmation prompt', () => {
    const fields: DailyReportFields = {
      workPerformed: 'Work done',
      crewSize: 5,
      equipment: [],
      materials: [],
      delays: '',
      delayHours: 0,
      safety: '',
    };

    const summary = formatDailySummary(fields);

    expect(summary).toContain('Reply OK to confirm or add corrections');
  });

  it('should handle workPerformed exactly at 100 chars', () => {
    const text = 'A'.repeat(100);
    const fields: DailyReportFields = {
      workPerformed: text,
      crewSize: 0,
      equipment: [],
      materials: [],
      delays: '',
      delayHours: 0,
      safety: '',
    };

    const summary = formatDailySummary(fields);

    expect(summary).not.toContain('...');
    expect(summary).toContain(text);
  });
});

describe('lookupUserByPhone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should find user by phone number', async () => {
    const mockMapping = {
      userId: 'user-123',
      phoneNumber: '+1234567890',
      isActive: true,
      user: { id: 'user-123', username: 'John Doe' },
      project: { id: 'project-456' },
    };

    mockPrisma.sMSMapping.findFirst.mockResolvedValue(mockMapping);

    const result = await lookupUserByPhone('+1234567890');

    expect(result).toEqual({
      userId: 'user-123',
      userName: 'John Doe',
      projectId: 'project-456',
    });
  });

  it('should return null for unknown phone', async () => {
    mockPrisma.sMSMapping.findFirst.mockResolvedValue(null);

    const result = await lookupUserByPhone('+9999999999');

    expect(result).toBeNull();
  });

  it('should filter by projectId when provided', async () => {
    mockPrisma.sMSMapping.findFirst.mockResolvedValue(null);

    await lookupUserByPhone('+1234567890', 'project-789');

    expect(mockPrisma.sMSMapping.findFirst).toHaveBeenCalledWith({
      where: {
        phoneNumber: '+1234567890',
        isActive: true,
        projectId: 'project-789',
        project: { smsEnabled: true },
      },
      include: {
        user: { select: { id: true, username: true } },
        project: { select: { id: true } },
      },
    });
  });

  it('should only return active mappings', async () => {
    mockPrisma.sMSMapping.findFirst.mockResolvedValue(null);

    await lookupUserByPhone('+1234567890');

    expect(mockPrisma.sMSMapping.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  it('should require project to have SMS enabled', async () => {
    mockPrisma.sMSMapping.findFirst.mockResolvedValue(null);

    await lookupUserByPhone('+1234567890');

    expect(mockPrisma.sMSMapping.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ project: { smsEnabled: true } }),
      })
    );
  });

  it('should handle database errors gracefully', async () => {
    mockPrisma.sMSMapping.findFirst.mockRejectedValue(new Error('Database error'));

    await expect(lookupUserByPhone('+1234567890')).rejects.toThrow('Database error');
  });

  it('should return correct user data structure', async () => {
    const mockMapping = {
      userId: 'user-456',
      phoneNumber: '+5555555555',
      isActive: true,
      user: { id: 'user-456', username: 'Jane Smith' },
      project: { id: 'project-999' },
    };

    mockPrisma.sMSMapping.findFirst.mockResolvedValue(mockMapping);

    const result = await lookupUserByPhone('+5555555555');

    expect(result).toHaveProperty('userId');
    expect(result).toHaveProperty('userName');
    expect(result).toHaveProperty('projectId');
    expect(result?.userId).toBe('user-456');
    expect(result?.userName).toBe('Jane Smith');
    expect(result?.projectId).toBe('project-999');
  });
});
