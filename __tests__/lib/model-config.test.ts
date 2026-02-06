import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FREE_MODEL,
  DEFAULT_MODEL,
  PREMIUM_MODEL,
  VISION_MODEL,
  FALLBACK_MODEL,
  SIMPLE_MODEL,
  EXTRACTION_MODEL,
  resolveModelAlias,
  isClaudeModel,
  isOpenAIModel,
} from '@/lib/model-config';

describe('Model Config', () => {
  describe('Constants', () => {
    it('should define DEFAULT_FREE_MODEL as gpt-4o-mini', () => {
      expect(DEFAULT_FREE_MODEL).toBe('gpt-4o-mini');
    });

    it('should define DEFAULT_MODEL as Claude Sonnet 4.5', () => {
      expect(DEFAULT_MODEL).toBe('claude-sonnet-4-5-20250929');
    });

    it('should define PREMIUM_MODEL as Claude Opus 4.6', () => {
      expect(PREMIUM_MODEL).toBe('claude-opus-4-6');
    });

    it('should define VISION_MODEL as Claude Opus 4.6', () => {
      expect(VISION_MODEL).toBe('claude-opus-4-6');
    });

    it('should define FALLBACK_MODEL as gpt-5.2', () => {
      expect(FALLBACK_MODEL).toBe('gpt-5.2');
    });

    it('should define SIMPLE_MODEL as gpt-4o-mini', () => {
      expect(SIMPLE_MODEL).toBe('gpt-4o-mini');
    });

    it('should define EXTRACTION_MODEL same as DEFAULT_MODEL', () => {
      expect(EXTRACTION_MODEL).toBe(DEFAULT_MODEL);
    });
  });

  describe('resolveModelAlias', () => {
    it('should resolve gpt-4o to FALLBACK_MODEL', () => {
      expect(resolveModelAlias('gpt-4o')).toBe(FALLBACK_MODEL);
    });

    it('should resolve gpt-3.5-turbo to SIMPLE_MODEL', () => {
      expect(resolveModelAlias('gpt-3.5-turbo')).toBe(SIMPLE_MODEL);
    });

    it('should resolve legacy Claude model to DEFAULT_MODEL', () => {
      expect(resolveModelAlias('claude-3-5-sonnet-20241022')).toBe(DEFAULT_MODEL);
      expect(resolveModelAlias('claude-sonnet-4-5-20251101')).toBe(DEFAULT_MODEL);
    });

    it('should return unknown models unchanged', () => {
      expect(resolveModelAlias('claude-opus-4-6')).toBe('claude-opus-4-6');
      expect(resolveModelAlias('gpt-4o-mini')).toBe('gpt-4o-mini');
    });
  });

  describe('isClaudeModel', () => {
    it('should return true for Claude models', () => {
      expect(isClaudeModel('claude-opus-4-6')).toBe(true);
      expect(isClaudeModel('claude-sonnet-4-5-20250929')).toBe(true);
    });

    it('should return false for non-Claude models', () => {
      expect(isClaudeModel('gpt-4o-mini')).toBe(false);
      expect(isClaudeModel('gpt-5.2')).toBe(false);
    });
  });

  describe('isOpenAIModel', () => {
    it('should return true for OpenAI models', () => {
      expect(isOpenAIModel('gpt-4o-mini')).toBe(true);
      expect(isOpenAIModel('gpt-5.2')).toBe(true);
      expect(isOpenAIModel('o3-mini')).toBe(true);
    });

    it('should return false for non-OpenAI models', () => {
      expect(isOpenAIModel('claude-opus-4-6')).toBe(false);
    });
  });
});
