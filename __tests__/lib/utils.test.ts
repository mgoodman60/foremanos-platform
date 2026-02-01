import { describe, it, expect } from 'vitest';
import { cn, formatDuration } from '@/lib/utils';

describe('utils', () => {
  // ============================================
  // cn() Tests - Class Name Utility
  // ============================================
  describe('cn', () => {
    it('should merge single class name', () => {
      const result = cn('text-blue-500');
      expect(result).toBe('text-blue-500');
    });

    it('should merge multiple class names', () => {
      const result = cn('text-blue-500', 'bg-red-200', 'p-4');
      expect(result).toBe('text-blue-500 bg-red-200 p-4');
    });

    it('should handle conditional class names with truthy values', () => {
      const result = cn('base-class', true && 'conditional-class');
      expect(result).toBe('base-class conditional-class');
    });

    it('should filter out conditional class names with falsy values', () => {
      const result = cn('base-class', false && 'excluded-class');
      expect(result).toBe('base-class');
    });

    it('should merge Tailwind conflicting classes correctly', () => {
      // twMerge should keep the last conflicting class
      const result = cn('p-4', 'p-6');
      expect(result).toBe('p-6');
    });

    it('should merge conflicting text colors correctly', () => {
      const result = cn('text-red-500', 'text-blue-500');
      expect(result).toBe('text-blue-500');
    });

    it('should merge conflicting background colors correctly', () => {
      const result = cn('bg-white', 'bg-black');
      expect(result).toBe('bg-black');
    });

    it('should handle empty string input', () => {
      const result = cn('');
      expect(result).toBe('');
    });

    it('should handle no arguments', () => {
      const result = cn();
      expect(result).toBe('');
    });

    it('should handle null and undefined values', () => {
      const result = cn('base-class', null, undefined, 'other-class');
      expect(result).toBe('base-class other-class');
    });

    it('should handle array of class names', () => {
      const result = cn(['text-sm', 'font-bold'], 'mt-2');
      expect(result).toBe('text-sm font-bold mt-2');
    });

    it('should handle object with boolean values', () => {
      const result = cn({
        'text-red-500': true,
        'bg-blue-500': false,
        'p-4': true,
      });
      expect(result).toBe('text-red-500 p-4');
    });

    it('should handle complex mixed inputs', () => {
      const isActive = true;
      const isDisabled = false;
      const result = cn(
        'base-class',
        isActive && 'active',
        isDisabled && 'disabled',
        ['flex', 'items-center'],
        { 'text-blue-500': true, 'hidden': false }
      );
      expect(result).toBe('base-class active flex items-center text-blue-500');
    });

    it('should preserve non-conflicting classes', () => {
      const result = cn('flex', 'items-center', 'justify-between', 'p-4');
      expect(result).toBe('flex items-center justify-between p-4');
    });

    it('should handle responsive classes', () => {
      const result = cn('text-sm', 'md:text-base', 'lg:text-lg');
      expect(result).toBe('text-sm md:text-base lg:text-lg');
    });

    it('should handle hover and focus states', () => {
      const result = cn('bg-blue-500', 'hover:bg-blue-600', 'focus:ring-2');
      expect(result).toBe('bg-blue-500 hover:bg-blue-600 focus:ring-2');
    });

    it('should handle dark mode classes', () => {
      const result = cn('bg-white', 'dark:bg-gray-900', 'text-black', 'dark:text-white');
      expect(result).toBe('bg-white dark:bg-gray-900 text-black dark:text-white');
    });

    it('should deduplicate identical class names', () => {
      const result = cn('flex', 'flex', 'items-center', 'items-center');
      expect(result).toBe('flex items-center');
    });

    it('should handle arbitrary values', () => {
      const result = cn('w-[200px]', 'h-[100px]', 'bg-[#1da1f2]');
      expect(result).toBe('w-[200px] h-[100px] bg-[#1da1f2]');
    });

    it('should handle important modifier', () => {
      const result = cn('!text-red-500', 'text-blue-500');
      // Both classes are kept; twMerge doesn't remove the non-important class
      expect(result).toBe('!text-red-500 text-blue-500');
    });

    it('should handle spacing conflicts correctly', () => {
      const result = cn('px-2', 'px-4', 'py-2');
      expect(result).toBe('px-4 py-2');
    });

    it('should merge with variant classes', () => {
      const variant = 'primary' as string;
      const result = cn(
        'btn',
        variant === 'primary' && 'bg-blue-500 text-white',
        variant === 'secondary' && 'bg-gray-500 text-white'
      );
      expect(result).toBe('btn bg-blue-500 text-white');
    });
  });

  // ============================================
  // formatDuration() Tests - Time Formatting
  // ============================================
  describe('formatDuration', () => {
    it('should format zero seconds', () => {
      expect(formatDuration(0)).toBe('00:00:00');
    });

    it('should format seconds only', () => {
      expect(formatDuration(30)).toBe('00:00:30');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(90)).toBe('00:01:30');
    });

    it('should format hours, minutes, and seconds', () => {
      expect(formatDuration(3661)).toBe('01:01:01');
    });

    it('should format exactly 1 hour', () => {
      expect(formatDuration(3600)).toBe('01:00:00');
    });

    it('should format exactly 1 minute', () => {
      expect(formatDuration(60)).toBe('00:01:00');
    });

    it('should format maximum seconds (59)', () => {
      expect(formatDuration(59)).toBe('00:00:59');
    });

    it('should format maximum minutes (59)', () => {
      expect(formatDuration(3599)).toBe('00:59:59');
    });

    it('should format multiple hours', () => {
      expect(formatDuration(7200)).toBe('02:00:00');
    });

    it('should format 24 hours', () => {
      expect(formatDuration(86400)).toBe('24:00:00');
    });

    it('should format more than 24 hours', () => {
      expect(formatDuration(90000)).toBe('25:00:00');
    });

    it('should pad single digit hours with zero', () => {
      expect(formatDuration(3600)).toBe('01:00:00');
    });

    it('should pad single digit minutes with zero', () => {
      expect(formatDuration(360)).toBe('00:06:00');
    });

    it('should pad single digit seconds with zero', () => {
      expect(formatDuration(7)).toBe('00:00:07');
    });

    it('should handle double digit hours correctly', () => {
      expect(formatDuration(36000)).toBe('10:00:00');
    });

    it('should handle double digit minutes correctly', () => {
      expect(formatDuration(600)).toBe('00:10:00');
    });

    it('should handle double digit seconds correctly', () => {
      expect(formatDuration(10)).toBe('00:00:10');
    });

    it('should format typical video duration (1:30:45)', () => {
      expect(formatDuration(5445)).toBe('01:30:45');
    });

    it('should format short video duration (0:05:30)', () => {
      expect(formatDuration(330)).toBe('00:05:30');
    });

    it('should format long duration (10:25:15)', () => {
      expect(formatDuration(37515)).toBe('10:25:15');
    });

    it('should handle very large hours (99+)', () => {
      expect(formatDuration(360000)).toBe('100:00:00');
    });

    it('should handle three digit hours', () => {
      expect(formatDuration(999 * 3600 + 59 * 60 + 59)).toBe('999:59:59');
    });

    it('should calculate minutes correctly from seconds', () => {
      // 125 seconds = 2 minutes 5 seconds
      expect(formatDuration(125)).toBe('00:02:05');
    });

    it('should calculate hours correctly from seconds', () => {
      // 7325 seconds = 2 hours 2 minutes 5 seconds
      expect(formatDuration(7325)).toBe('02:02:05');
    });

    it('should handle boundary at 60 seconds', () => {
      expect(formatDuration(60)).toBe('00:01:00');
      expect(formatDuration(61)).toBe('00:01:01');
    });

    it('should handle boundary at 3600 seconds', () => {
      expect(formatDuration(3600)).toBe('01:00:00');
      expect(formatDuration(3601)).toBe('01:00:01');
    });

    it('should handle modulo calculation correctly for seconds', () => {
      // 3665 seconds = 1 hour 1 minute 5 seconds
      // 3665 % 60 = 5
      expect(formatDuration(3665)).toBe('01:01:05');
    });

    it('should handle modulo calculation correctly for minutes', () => {
      // 7380 seconds = 2 hours 3 minutes 0 seconds
      // (7380 % 3600) / 60 = 3
      expect(formatDuration(7380)).toBe('02:03:00');
    });

    it('should return string type', () => {
      const result = formatDuration(100);
      expect(typeof result).toBe('string');
    });

    it('should always return HH:MM:SS format', () => {
      const results = [
        formatDuration(0),
        formatDuration(59),
        formatDuration(3599),
        formatDuration(3661),
        formatDuration(86400),
      ];

      results.forEach((result) => {
        expect(result).toMatch(/^\d{2,}:\d{2}:\d{2}$/);
      });
    });

    it('should format construction project duration (8 hour workday)', () => {
      // 8 hours = 28800 seconds
      expect(formatDuration(28800)).toBe('08:00:00');
    });

    it('should format typical meeting duration (1.5 hours)', () => {
      // 1.5 hours = 5400 seconds
      expect(formatDuration(5400)).toBe('01:30:00');
    });

    it('should format break time (15 minutes)', () => {
      // 15 minutes = 900 seconds
      expect(formatDuration(900)).toBe('00:15:00');
    });
  });

  // ============================================
  // Edge Cases and Integration Tests
  // ============================================
  describe('Edge Cases', () => {
    describe('cn edge cases', () => {
      it('should handle deeply nested arrays', () => {
        const result = cn(['flex', ['items-center', ['justify-between', 'p-4']]]);
        expect(result).toBe('flex items-center justify-between p-4');
      });

      it('should handle whitespace in class names', () => {
        const result = cn('  text-sm  ', '  font-bold  ');
        expect(result).toBe('text-sm font-bold');
      });

      it('should handle very long class name strings', () => {
        const longClass = 'a'.repeat(1000);
        const result = cn(longClass);
        expect(result).toBe(longClass);
      });
    });

    describe('formatDuration edge cases', () => {
      it('should handle decimal seconds by preserving decimal in output', () => {
        // The function uses toString() which preserves decimals
        const result = formatDuration(90.9);
        expect(result).toContain('00:01:30');
        expect(result).toContain('.');
      });

      it('should handle very small decimal values', () => {
        // Decimals are preserved in toString() output
        expect(formatDuration(0.1)).toContain('00:00:0');
        expect(formatDuration(0.9)).toContain('00:00:0');
      });

      it('should handle negative seconds (produces negative components)', () => {
        // Current implementation doesn't handle negative, but test actual behavior
        const result = formatDuration(-60);
        // Math.floor(-60 / 3600) = -1, Math.floor((-60 % 3600) / 60) = -1
        expect(result).toBe('-1:-1:00');
      });

      it('should handle Infinity gracefully', () => {
        const result = formatDuration(Infinity);
        expect(result).toContain('Infinity');
      });

      it('should handle NaN gracefully', () => {
        const result = formatDuration(NaN);
        expect(result).toContain('NaN');
      });

      it('should handle maximum safe integer', () => {
        const maxSafe = Number.MAX_SAFE_INTEGER;
        const result = formatDuration(maxSafe);
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^\d+:\d{2}:\d{2}$/);
      });
    });
  });

  // ============================================
  // Type Safety Tests
  // ============================================
  describe('Type Safety', () => {
    it('should accept ClassValue types for cn', () => {
      // String
      expect(() => cn('class')).not.toThrow();

      // Array
      expect(() => cn(['class1', 'class2'])).not.toThrow();

      // Object
      expect(() => cn({ active: true, disabled: false })).not.toThrow();

      // Mixed
      expect(() => cn('base', ['array-class'], { 'obj-class': true })).not.toThrow();
    });

    it('should accept number type for formatDuration', () => {
      expect(() => formatDuration(0)).not.toThrow();
      expect(() => formatDuration(100)).not.toThrow();
      expect(() => formatDuration(3600)).not.toThrow();
    });

    it('should return string from cn', () => {
      const result = cn('class');
      expect(typeof result).toBe('string');
    });

    it('should return string from formatDuration', () => {
      const result = formatDuration(100);
      expect(typeof result).toBe('string');
    });
  });

  // ============================================
  // Integration Tests
  // ============================================
  describe('Integration', () => {
    it('should support common UI component patterns', () => {
      const isActive = true;
      const isLoading = false;
      const variant = 'primary' as string;

      const buttonClasses = cn(
        'inline-flex items-center justify-center rounded-md font-medium',
        'transition-colors focus:outline-none focus:ring-2',
        variant === 'primary' && 'bg-blue-500 text-white hover:bg-blue-600',
        variant === 'secondary' && 'bg-gray-200 text-gray-900 hover:bg-gray-300',
        isActive && 'ring-2 ring-blue-500',
        isLoading && 'opacity-50 cursor-not-allowed',
        'px-4 py-2'
      );

      expect(buttonClasses).toContain('inline-flex');
      expect(buttonClasses).toContain('bg-blue-500');
      expect(buttonClasses).toContain('ring-2 ring-blue-500');
      expect(buttonClasses).not.toContain('opacity-50');
    });

    it('should format durations for video player UI', () => {
      const currentTime = 125; // 2:05
      const totalTime = 3661; // 1:01:01

      expect(formatDuration(currentTime)).toBe('00:02:05');
      expect(formatDuration(totalTime)).toBe('01:01:01');
    });

    it('should format durations for construction time tracking', () => {
      const morningSession = 4 * 3600; // 4 hours
      const afternoonSession = 3.5 * 3600; // 3.5 hours
      const totalDay = morningSession + afternoonSession;

      expect(formatDuration(morningSession)).toBe('04:00:00');
      expect(formatDuration(afternoonSession)).toBe('03:30:00');
      expect(formatDuration(totalDay)).toBe('07:30:00');
    });

    it('should support conditional styling with cn', () => {
      const status = 'success' as string;
      const statusClasses = cn(
        'px-2 py-1 rounded text-sm font-semibold',
        status === 'success' && 'bg-green-100 text-green-800',
        status === 'warning' && 'bg-yellow-100 text-yellow-800',
        status === 'error' && 'bg-red-100 text-red-800'
      );

      expect(statusClasses).toContain('bg-green-100');
      expect(statusClasses).toContain('text-green-800');
      expect(statusClasses).not.toContain('bg-yellow-100');
      expect(statusClasses).not.toContain('bg-red-100');
    });

    it('should handle responsive design patterns', () => {
      const containerClasses = cn(
        'w-full',
        'sm:w-auto',
        'md:w-1/2',
        'lg:w-1/3',
        'xl:w-1/4',
        'p-4',
        'sm:p-6',
        'md:p-8'
      );

      expect(containerClasses).toContain('w-full');
      expect(containerClasses).toContain('sm:w-auto');
      expect(containerClasses).toContain('md:w-1/2');
      expect(containerClasses).toContain('lg:w-1/3');
      expect(containerClasses).toContain('xl:w-1/4');
    });
  });
});
