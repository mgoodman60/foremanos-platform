import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validatePassword } from '@/lib/password-validator';
import type { PasswordValidationResult } from '@/lib/password-validator';

describe('password-validator', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Store original env value
    originalEnv = process.env.ALLOW_WEAK_PASSWORDS;
  });

  afterEach(() => {
    // Restore original env value
    if (originalEnv === undefined) {
      delete process.env.ALLOW_WEAK_PASSWORDS;
    } else {
      process.env.ALLOW_WEAK_PASSWORDS = originalEnv;
    }
  });

  // ============================================
  // Valid Password Tests
  // ============================================
  describe('validatePassword - valid passwords', () => {
    it('should accept password with all required criteria', () => {
      const result = validatePassword('SecurePass123');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept password with exactly 12 characters', () => {
      const result = validatePassword('SecurePass12');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept very long password', () => {
      const result = validatePassword('ThisIsAVeryLongPasswordWith123UppercaseAndLowercaseLetters');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept password with multiple numbers and special patterns', () => {
      const result = validatePassword('MyP@ssw0rd123');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  // ============================================
  // Minimum Length Tests
  // ============================================
  describe('validatePassword - minimum length', () => {
    it('should reject password with less than 12 characters', () => {
      const result = validatePassword('Short1Aa');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must be at least 12 characters long');
    });

    it('should reject password with 11 characters', () => {
      const result = validatePassword('SecurePass1');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must be at least 12 characters long');
    });

    it('should reject empty string', () => {
      const result = validatePassword('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must be at least 12 characters long');
    });
  });

  // ============================================
  // Character Requirement Tests
  // ============================================
  describe('validatePassword - character requirements', () => {
    it('should reject password without lowercase letters', () => {
      const result = validatePassword('UPPERCASE123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must contain at least one lowercase letter');
    });

    it('should reject password without uppercase letters', () => {
      const result = validatePassword('lowercase123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must contain at least one uppercase letter');
    });

    it('should reject password without numbers', () => {
      const result = validatePassword('NoNumbersHere');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must contain at least one number');
    });

    it('should reject password with only special characters and numbers', () => {
      const result = validatePassword('!@#$%^&*()123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must contain at least one lowercase letter');
    });
  });

  // ============================================
  // Common Password Tests
  // ============================================
  describe('validatePassword - common passwords', () => {
    it('should reject common password "password" (fails length first)', () => {
      const result = validatePassword('password');
      expect(result.valid).toBe(false);
      // 'password' is 8 chars, so it fails length check before common password check
      expect(result.error).toBe('Password must be at least 12 characters long');
    });

    it('should reject common password "123456"', () => {
      const result = validatePassword('123456');
      expect(result.valid).toBe(false);
      // First fails length check
      expect(result.error).toBe('Password must be at least 12 characters long');
    });

    it('should reject common password "password1" case-insensitively', () => {
      // PASSWORD1 is 9 chars, fails length first
      const result = validatePassword('PASSWORD1');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must be at least 12 characters long');
    });

    it('should reject a long common password', () => {
      // Test a common password that's long enough to pass length check
      const result = validatePassword('password1234');
      expect(result.valid).toBe(false);
      // Still fails because missing uppercase
      expect(result.error).toBe('Password must contain at least one uppercase letter');
    });

    it('should reject common password "qwerty"', () => {
      const result = validatePassword('qwerty');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must be at least 12 characters long');
    });

    it('should reject common password "welcome"', () => {
      const result = validatePassword('welcome');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must be at least 12 characters long');
    });

    it('should reject common password "admin"', () => {
      const result = validatePassword('admin');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must be at least 12 characters long');
    });
  });

  // ============================================
  // ALLOW_WEAK_PASSWORDS Environment Variable Tests
  // ============================================
  describe('validatePassword - ALLOW_WEAK_PASSWORDS behavior', () => {
    it('should allow weak password when ALLOW_WEAK_PASSWORDS=true and length >= 3', () => {
      process.env.ALLOW_WEAK_PASSWORDS = 'true';
      const result = validatePassword('abc');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should allow very weak password when ALLOW_WEAK_PASSWORDS=true', () => {
      process.env.ALLOW_WEAK_PASSWORDS = 'true';
      const result = validatePassword('password');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject password with length < 3 even when ALLOW_WEAK_PASSWORDS=true', () => {
      process.env.ALLOW_WEAK_PASSWORDS = 'true';
      const result = validatePassword('ab');
      expect(result.valid).toBe(false);
      // Falls through to normal validation
      expect(result.error).toBe('Password must be at least 12 characters long');
    });

    it('should NOT allow weak passwords when ALLOW_WEAK_PASSWORDS=false', () => {
      process.env.ALLOW_WEAK_PASSWORDS = 'false';
      const result = validatePassword('abc');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must be at least 12 characters long');
    });

    it('should NOT allow weak passwords when ALLOW_WEAK_PASSWORDS is undefined', () => {
      delete process.env.ALLOW_WEAK_PASSWORDS;
      const result = validatePassword('abc');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must be at least 12 characters long');
    });

    it('should NOT allow weak passwords when ALLOW_WEAK_PASSWORDS is any other value', () => {
      process.env.ALLOW_WEAK_PASSWORDS = 'yes';
      const result = validatePassword('abc');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Password must be at least 12 characters long');
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe('validatePassword - edge cases', () => {
    it('should handle password with Unicode characters', () => {
      // Unicode chars count as 1 character each, so make it 12+ chars
      const result = validatePassword('Pāsswørd1234');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle password with spaces', () => {
      const result = validatePassword('My Pass Word 123');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle password with special characters', () => {
      const result = validatePassword('P@ssw0rd!#$%');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle extremely long password', () => {
      const longPassword = 'A1' + 'a'.repeat(1000);
      const result = validatePassword(longPassword);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return correct type structure', () => {
      const result: PasswordValidationResult = validatePassword('ValidPass123');
      expect(result).toHaveProperty('valid');
      expect(typeof result.valid).toBe('boolean');
      if (!result.valid) {
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
      }
    });
  });
});
