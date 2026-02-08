import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ prisma: {} }));

import { classifyQueryIntent } from '@/lib/rag-enhancements';

describe('rag-enhancements - classifyQueryIntent - daily_report', () => {
  describe('Daily report queries should return type daily_report', () => {
    it('should classify "what did we do last Tuesday"', () => {
      const result = classifyQueryIntent('what did we do last Tuesday');
      expect(result.type).toBe('daily_report');
    });

    it('should classify "what work was performed yesterday"', () => {
      const result = classifyQueryIntent('what work was performed yesterday');
      expect(result.type).toBe('daily_report');
    });

    it('should classify "crew size on January 5th"', () => {
      const result = classifyQueryIntent('crew size on January 5th');
      expect(result.type).toBe('daily_report');
    });

    it('should classify "weather conditions last week"', () => {
      const result = classifyQueryIntent('weather conditions last week');
      expect(result.type).toBe('daily_report');
    });

    it('should classify "any safety incidents yesterday"', () => {
      const result = classifyQueryIntent('any safety incidents yesterday');
      expect(result.type).toBe('daily_report');
    });

    it('should classify "equipment on site last Monday"', () => {
      const result = classifyQueryIntent('equipment on site last Monday');
      expect(result.type).toBe('daily_report');
    });

    it('should classify "daily report for 2/5"', () => {
      const result = classifyQueryIntent('daily report for 2/5');
      expect(result.type).toBe('daily_report');
    });

    it('should classify "what delays happened this week"', () => {
      const result = classifyQueryIntent('what delays happened this week');
      expect(result.type).toBe('daily_report');
    });

    it('should classify "show me the field report"', () => {
      const result = classifyQueryIntent('show me the field report');
      expect(result.type).toBe('daily_report');
    });

    it('should classify queries with date pattern "on 2/5"', () => {
      const result = classifyQueryIntent('What happened on 2/5');
      expect(result.type).toBe('daily_report');
    });

    it('should classify queries with date pattern "on January 5"', () => {
      const result = classifyQueryIntent('crew size on January 5');
      expect(result.type).toBe('daily_report');
    });

    it('should classify queries with date pattern "on the 5th"', () => {
      const result = classifyQueryIntent('weather on the 5th');
      expect(result.type).toBe('daily_report');
    });

    it('should classify "what work was done last Friday"', () => {
      const result = classifyQueryIntent('what work was done last Friday');
      expect(result.type).toBe('daily_report');
    });

    it('should classify "how many workers last Wednesday"', () => {
      const result = classifyQueryIntent('how many workers last Wednesday');
      expect(result.type).toBe('daily_report');
    });

    it('should classify "equipment used on the 12th"', () => {
      const result = classifyQueryIntent('equipment used on the 12th');
      expect(result.type).toBe('daily_report');
    });
  });

  describe('Non-regression - should NOT return daily_report', () => {
    it('should classify "how many doors are on the plan" as counting', () => {
      const result = classifyQueryIntent('how many doors are on the plan');
      expect(result.type).toBe('counting');
      expect(result.type).not.toBe('daily_report');
    });

    it('should classify "what is the HVAC system layout" as mep', () => {
      const result = classifyQueryIntent('what is the HVAC system layout');
      expect(result.type).toBe('mep');
      expect(result.type).not.toBe('daily_report');
    });

    it('should NOT classify "how thick is the foundation wall" as daily_report', () => {
      const result = classifyQueryIntent('how thick is the foundation wall');
      expect(result.type).not.toBe('daily_report');
    });

    it('should classify "generate a takeoff for plumbing" as takeoff', () => {
      const result = classifyQueryIntent('generate a takeoff for plumbing');
      expect(result.type).toBe('takeoff');
      expect(result.type).not.toBe('daily_report');
    });

    it('should classify "where is detail A3.1" as location', () => {
      const result = classifyQueryIntent('where is detail A3.1');
      expect(result.type).toBe('location');
      expect(result.type).not.toBe('daily_report');
    });
  });
});
