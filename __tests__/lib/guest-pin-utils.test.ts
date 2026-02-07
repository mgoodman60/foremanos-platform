import { describe, it, expect } from 'vitest';
import { namespacePIN, stripPINPrefix } from '@/lib/guest-pin-utils';

describe('guest-pin-utils', () => {
  describe('namespacePIN', () => {
    it('should create namespaced PIN from owner ID and PIN', () => {
      expect(namespacePIN('clxyz123', 'Job123')).toBe('clxyz123_Job123');
    });

    it('should handle special characters in PIN', () => {
      expect(namespacePIN('owner1', 'My-Job_2024')).toBe('owner1_My-Job_2024');
    });

    it('should handle empty PIN', () => {
      expect(namespacePIN('owner1', '')).toBe('owner1_');
    });

    it('should handle empty owner ID', () => {
      expect(namespacePIN('', 'Job123')).toBe('_Job123');
    });

    it('should handle PIN with spaces', () => {
      expect(namespacePIN('owner1', 'My Job')).toBe('owner1_My Job');
    });

    it('should handle long owner IDs and PINs', () => {
      const longOwner = 'a'.repeat(50);
      const longPin = 'b'.repeat(50);
      expect(namespacePIN(longOwner, longPin)).toBe(`${longOwner}_${longPin}`);
    });
  });

  describe('stripPINPrefix', () => {
    it('should strip owner prefix from namespaced PIN', () => {
      expect(stripPINPrefix('clxyz123_Job123')).toBe('Job123');
    });

    it('should return full string for legacy un-namespaced PINs', () => {
      expect(stripPINPrefix('LegacyJob')).toBe('LegacyJob');
    });

    it('should handle PINs with underscores after the namespace separator', () => {
      expect(stripPINPrefix('owner1_My-Job_2024')).toBe('My-Job_2024');
    });

    it('should handle empty string', () => {
      expect(stripPINPrefix('')).toBe('');
    });

    it('should handle string with only underscore', () => {
      expect(stripPINPrefix('_')).toBe('');
    });

    it('should handle string ending with underscore', () => {
      expect(stripPINPrefix('owner_')).toBe('');
    });

    it('should handle string starting with underscore', () => {
      expect(stripPINPrefix('_Job123')).toBe('Job123');
    });

    it('should handle multiple underscores preserving everything after first', () => {
      expect(stripPINPrefix('a_b_c_d')).toBe('b_c_d');
    });
  });

  describe('roundtrip', () => {
    it('should roundtrip a simple PIN', () => {
      const namespaced = namespacePIN('owner123', 'Job456');
      expect(stripPINPrefix(namespaced)).toBe('Job456');
    });

    it('should roundtrip a PIN with underscores', () => {
      const namespaced = namespacePIN('owner123', 'My_Job_2024');
      expect(stripPINPrefix(namespaced)).toBe('My_Job_2024');
    });

    it('should roundtrip a PIN with special characters', () => {
      const namespaced = namespacePIN('user-abc', 'Project-#1');
      expect(stripPINPrefix(namespaced)).toBe('Project-#1');
    });
  });
});
