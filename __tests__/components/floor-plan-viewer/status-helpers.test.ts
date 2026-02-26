import { describe, it, expect } from 'vitest';
import {
  getStatusColor,
  getStatusHoverColor,
  getTypeColor,
} from '@/components/floor-plan-viewer/status-helpers';

// ---------------------------------------------------------------------------
// getStatusColor
// ---------------------------------------------------------------------------
describe('getStatusColor', () => {
  it('should return green classes for "completed" status', () => {
    expect(getStatusColor('completed')).toBe('border-green-500 bg-green-500/30');
  });

  it('should return blue classes for "in_progress" status', () => {
    expect(getStatusColor('in_progress')).toBe('border-blue-500 bg-blue-500/30');
  });

  it('should return gray classes for an unknown status', () => {
    expect(getStatusColor('pending')).toBe('border-gray-400 bg-gray-400/20');
  });

  it('should return gray classes for an empty string', () => {
    expect(getStatusColor('')).toBe('border-gray-400 bg-gray-400/20');
  });

  it('should return gray classes for "not_started"', () => {
    expect(getStatusColor('not_started')).toBe('border-gray-400 bg-gray-400/20');
  });

  it('should return gray classes for "cancelled"', () => {
    expect(getStatusColor('cancelled')).toBe('border-gray-400 bg-gray-400/20');
  });

  it('should be case-sensitive and not match "Completed" (uppercase C)', () => {
    // Switch uses strict equality — 'Completed' does not match 'completed'
    expect(getStatusColor('Completed')).toBe('border-gray-400 bg-gray-400/20');
  });

  it('should be case-sensitive and not match "IN_PROGRESS" (uppercase)', () => {
    expect(getStatusColor('IN_PROGRESS')).toBe('border-gray-400 bg-gray-400/20');
  });
});

// ---------------------------------------------------------------------------
// getStatusHoverColor
// ---------------------------------------------------------------------------
describe('getStatusHoverColor', () => {
  it('should return green hover classes for "completed" status', () => {
    expect(getStatusHoverColor('completed')).toBe('border-green-400 bg-green-500/50');
  });

  it('should return blue hover classes for "in_progress" status', () => {
    expect(getStatusHoverColor('in_progress')).toBe('border-blue-400 bg-blue-500/50');
  });

  it('should return orange hover classes for an unknown status', () => {
    expect(getStatusHoverColor('pending')).toBe('border-orange-400 bg-orange-500/40');
  });

  it('should return orange hover classes for an empty string', () => {
    expect(getStatusHoverColor('')).toBe('border-orange-400 bg-orange-500/40');
  });

  it('should return orange hover classes for "on_hold"', () => {
    expect(getStatusHoverColor('on_hold')).toBe('border-orange-400 bg-orange-500/40');
  });

  it('should return orange hover classes for "cancelled"', () => {
    expect(getStatusHoverColor('cancelled')).toBe('border-orange-400 bg-orange-500/40');
  });

  it('should be case-sensitive and not match "Completed" (uppercase C)', () => {
    expect(getStatusHoverColor('Completed')).toBe('border-orange-400 bg-orange-500/40');
  });

  it('should be case-sensitive and not match "In_Progress" (mixed case)', () => {
    expect(getStatusHoverColor('In_Progress')).toBe('border-orange-400 bg-orange-500/40');
  });
});

// ---------------------------------------------------------------------------
// getTypeColor
// ---------------------------------------------------------------------------
describe('getTypeColor', () => {
  describe('Known room types', () => {
    it('should return blue classes for "office"', () => {
      expect(getTypeColor('office')).toBe('bg-blue-500/40 border-blue-500');
    });

    it('should return purple classes for "conference"', () => {
      expect(getTypeColor('conference')).toBe('bg-purple-500/40 border-purple-500');
    });

    it('should return cyan classes for "restroom"', () => {
      expect(getTypeColor('restroom')).toBe('bg-cyan-500/40 border-cyan-500');
    });

    it('should return gray classes for "corridor"', () => {
      expect(getTypeColor('corridor')).toBe('bg-gray-500/40 border-gray-500');
    });

    it('should return amber classes for "lobby"', () => {
      expect(getTypeColor('lobby')).toBe('bg-amber-500/40 border-amber-500');
    });

    it('should return orange classes for "storage"', () => {
      expect(getTypeColor('storage')).toBe('bg-orange-500/40 border-orange-500');
    });

    it('should return red classes for "mechanical"', () => {
      expect(getTypeColor('mechanical')).toBe('bg-red-500/40 border-red-500');
    });

    it('should return yellow classes for "electrical"', () => {
      expect(getTypeColor('electrical')).toBe('bg-yellow-500/40 border-yellow-500');
    });

    it('should return green classes for "multipurpose"', () => {
      expect(getTypeColor('multipurpose')).toBe('bg-green-500/40 border-green-500');
    });

    it('should return teal classes for "exam_room"', () => {
      expect(getTypeColor('exam_room')).toBe('bg-teal-500/40 border-teal-500');
    });

    it('should return indigo classes for "waiting"', () => {
      expect(getTypeColor('waiting')).toBe('bg-indigo-500/40 border-indigo-500');
    });

    it('should return pink classes for "reception"', () => {
      expect(getTypeColor('reception')).toBe('bg-pink-500/40 border-pink-500');
    });
  });

  describe('Case insensitivity', () => {
    it('should return the same blue classes for "Office" (capitalized)', () => {
      expect(getTypeColor('Office')).toBe('bg-blue-500/40 border-blue-500');
    });

    it('should return the same purple classes for "CONFERENCE" (all caps)', () => {
      expect(getTypeColor('CONFERENCE')).toBe('bg-purple-500/40 border-purple-500');
    });

    it('should return the same cyan classes for "Restroom" (title case)', () => {
      expect(getTypeColor('Restroom')).toBe('bg-cyan-500/40 border-cyan-500');
    });

    it('should return the same red classes for "MECHANICAL" (all caps)', () => {
      expect(getTypeColor('MECHANICAL')).toBe('bg-red-500/40 border-red-500');
    });
  });

  describe('Unknown room types', () => {
    it('should return the gray fallback for an unrecognized type', () => {
      expect(getTypeColor('kitchen')).toBe('bg-gray-500/30 border-gray-500');
    });

    it('should return the gray fallback for an empty string', () => {
      expect(getTypeColor('')).toBe('bg-gray-500/30 border-gray-500');
    });

    it('should return the gray fallback for a numeric-like type string', () => {
      expect(getTypeColor('room_101')).toBe('bg-gray-500/30 border-gray-500');
    });

    it('should return the gray fallback for "utility"', () => {
      expect(getTypeColor('utility')).toBe('bg-gray-500/30 border-gray-500');
    });
  });
});
