const COMMON_PASSWORDS = ['password', '123456', '12345678', 'qwerty', 'abc123', 'password1', 'admin', 'letmein', 'welcome', 'monkey'];

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePassword(password: string): PasswordValidationResult {
  // Relaxed rules in development mode
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev && password.length >= 3) {
    return { valid: true };
  }

  if (password.length < 12) {
    return { valid: false, error: 'Password must be at least 12 characters long' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    return { valid: false, error: 'Password is too common' };
  }
  return { valid: true };
}
