/**
 * Error Messages Utility
 *
 * Maps error codes and types to user-friendly messages with recovery actions.
 * Provides consistent error handling across the application.
 */

import { logger } from '@/lib/logger';

export type ErrorCategory =
  | 'network'
  | 'auth'
  | 'permission'
  | 'validation'
  | 'file'
  | 'server'
  | 'rate_limit'
  | 'subscription'
  | 'unknown';

export interface ErrorInfo {
  /** User-friendly error title */
  title: string;
  /** Detailed error message */
  message: string;
  /** Recovery actions the user can take */
  recoveryActions: string[];
  /** Whether the error is recoverable (can retry) */
  recoverable: boolean;
  /** Suggested action button text */
  actionText?: string;
  /** Action type: retry, refresh, redirect, contact */
  actionType?: 'retry' | 'refresh' | 'redirect' | 'contact' | 'upgrade';
  /** Redirect path if actionType is 'redirect' */
  redirectPath?: string;
}

/**
 * HTTP status code to error category mapping
 */
const STATUS_CODE_MAP: Record<number, ErrorCategory> = {
  400: 'validation',
  401: 'auth',
  403: 'permission',
  404: 'validation',
  408: 'network',
  413: 'file',
  415: 'file',
  429: 'rate_limit',
  500: 'server',
  502: 'server',
  503: 'server',
  504: 'network',
};

/**
 * Error information for each category
 */
const ERROR_INFO_MAP: Record<ErrorCategory, ErrorInfo> = {
  network: {
    title: 'Connection Error',
    message:
      'Unable to connect to the server. This might be due to your internet connection or the server being temporarily unavailable.',
    recoveryActions: [
      'Check your internet connection',
      'Disable VPN if enabled',
      'Try refreshing the page',
      'Wait a moment and try again',
    ],
    recoverable: true,
    actionText: 'Try Again',
    actionType: 'retry',
  },
  auth: {
    title: 'Session Expired',
    message:
      'Your session has expired or is invalid. Please sign in again to continue.',
    recoveryActions: [
      'Sign in again with your credentials',
      'Clear browser cookies if the problem persists',
      'Check that you are using the correct account',
    ],
    recoverable: false,
    actionText: 'Sign In',
    actionType: 'redirect',
    redirectPath: '/login',
  },
  permission: {
    title: 'Access Denied',
    message:
      'You do not have permission to access this resource. Contact the project owner if you believe this is an error.',
    recoveryActions: [
      'Request access from the project owner',
      'Check that you are signed into the correct account',
      'Verify your role and permissions',
    ],
    recoverable: false,
    actionText: 'Go to Dashboard',
    actionType: 'redirect',
    redirectPath: '/dashboard',
  },
  validation: {
    title: 'Invalid Request',
    message:
      'The data you submitted is invalid or incomplete. Please check your input and try again.',
    recoveryActions: [
      'Review and correct the highlighted fields',
      'Ensure all required fields are filled',
      'Check that file formats are supported',
    ],
    recoverable: true,
    actionText: 'Try Again',
    actionType: 'retry',
  },
  file: {
    title: 'File Error',
    message:
      'There was a problem with the file you uploaded. It may be too large, corrupted, or in an unsupported format.',
    recoveryActions: [
      'Ensure the file is under 200MB',
      'Use supported formats: PDF, DOCX',
      'Try compressing or splitting large files',
      'Check that the file is not corrupted',
    ],
    recoverable: true,
    actionText: 'Try Different File',
    actionType: 'retry',
  },
  server: {
    title: 'Server Error',
    message:
      'Something went wrong on our end. Our team has been notified and is working to fix the issue.',
    recoveryActions: [
      'Wait a few minutes and try again',
      'Refresh the page',
      'Contact support if the problem persists',
    ],
    recoverable: true,
    actionText: 'Refresh Page',
    actionType: 'refresh',
  },
  rate_limit: {
    title: 'Too Many Requests',
    message:
      'You have made too many requests in a short period. Please wait a moment before trying again.',
    recoveryActions: [
      'Wait 1-2 minutes before trying again',
      'Avoid rapidly clicking buttons',
      'Consider upgrading your plan for higher limits',
    ],
    recoverable: true,
    actionText: 'Wait & Retry',
    actionType: 'retry',
  },
  subscription: {
    title: 'Upgrade Required',
    message:
      'This feature requires a higher subscription tier. Upgrade your plan to access this functionality.',
    recoveryActions: [
      'Review your current plan limits',
      'Upgrade to a higher tier for more features',
      'Contact sales for custom enterprise plans',
    ],
    recoverable: false,
    actionText: 'View Plans',
    actionType: 'redirect',
    redirectPath: '/pricing',
  },
  unknown: {
    title: 'Something Went Wrong',
    message:
      'An unexpected error occurred. Please try again or contact support if the problem persists.',
    recoveryActions: [
      'Try the action again',
      'Refresh the page',
      'Clear browser cache and cookies',
      'Contact support with error details',
    ],
    recoverable: true,
    actionText: 'Try Again',
    actionType: 'retry',
  },
};

/**
 * Categorizes an error based on its type and content
 */
export function categorizeError(
  error: Error | string | Response | number,
  __context?: string // Reserved for future context-aware categorization
): ErrorCategory {
  // HTTP status code
  if (typeof error === 'number') {
    return STATUS_CODE_MAP[error] || 'unknown';
  }

  // Response object
  if (error instanceof Response) {
    return STATUS_CODE_MAP[error.status] || 'unknown';
  }

  // Error message
  const message = typeof error === 'string' ? error.toLowerCase() : error.message?.toLowerCase() || '';

  // Network errors
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('offline') ||
    message.includes('aborted')
  ) {
    return 'network';
  }

  // Auth errors
  if (
    message.includes('unauthorized') ||
    message.includes('unauthenticated') ||
    message.includes('session') ||
    message.includes('token') ||
    message.includes('sign in') ||
    message.includes('login')
  ) {
    return 'auth';
  }

  // Permission errors
  if (
    message.includes('forbidden') ||
    message.includes('permission') ||
    message.includes('access denied') ||
    message.includes('not allowed')
  ) {
    return 'permission';
  }

  // File errors
  if (
    message.includes('file') ||
    message.includes('upload') ||
    message.includes('size') ||
    message.includes('format') ||
    message.includes('type')
  ) {
    return 'file';
  }

  // Rate limit errors
  if (
    message.includes('rate') ||
    message.includes('limit') ||
    message.includes('too many') ||
    message.includes('quota')
  ) {
    return 'rate_limit';
  }

  // Subscription errors
  if (
    message.includes('subscription') ||
    message.includes('upgrade') ||
    message.includes('tier') ||
    message.includes('plan')
  ) {
    return 'subscription';
  }

  // Server errors
  if (
    message.includes('server') ||
    message.includes('internal') ||
    message.includes('500')
  ) {
    return 'server';
  }

  // Validation errors
  if (
    message.includes('invalid') ||
    message.includes('required') ||
    message.includes('validation')
  ) {
    return 'validation';
  }

  return 'unknown';
}

/**
 * Gets user-friendly error information for display
 */
export function getErrorInfo(
  error: Error | string | Response | number,
  context?: string
): ErrorInfo {
  const category = categorizeError(error, context);
  const info = ERROR_INFO_MAP[category];

  // Add specific error message if available
  let specificMessage = '';
  if (typeof error === 'string') {
    specificMessage = error;
  } else if (error instanceof Error) {
    specificMessage = error.message;
  }

  // Customize message for specific contexts
  if (context && specificMessage) {
    return {
      ...info,
      message: `${info.message} (${specificMessage})`,
    };
  }

  return info;
}

/**
 * Gets a simple user-friendly error message string
 */
export function getUserFriendlyMessage(
  error: Error | string | Response | number,
  fallback = 'Something went wrong. Please try again.'
): string {
  const info = getErrorInfo(error);
  return info.message || fallback;
}

/**
 * Formats an error for display in a toast notification
 */
export function formatToastError(error: Error | string): {
  title: string;
  description: string;
} {
  const info = getErrorInfo(error);
  return {
    title: info.title,
    description: info.recoveryActions[0] || info.message,
  };
}

/**
 * Checks if an error is recoverable (can be retried)
 */
export function isRecoverableError(
  error: Error | string | Response | number
): boolean {
  const info = getErrorInfo(error);
  return info.recoverable;
}

/**
 * Gets recovery action suggestions for an error
 */
export function getRecoveryActions(
  error: Error | string | Response | number
): string[] {
  const info = getErrorInfo(error);
  return info.recoveryActions;
}

/**
 * Creates a standardized error object for API responses
 */
export function createApiError(
  statusCode: number,
  message: string,
  details?: Record<string, unknown>
): {
  error: {
    code: number;
    message: string;
    category: ErrorCategory;
    details?: Record<string, unknown>;
  };
} {
  return {
    error: {
      code: statusCode,
      message,
      category: categorizeError(statusCode),
      details,
    },
  };
}

/**
 * Logs error with appropriate severity
 */
export function logError(
  error: Error | string,
  context?: string,
  severity: 'info' | 'warn' | 'error' = 'error'
): void {
  const category = categorizeError(error);
  const message = typeof error === 'string' ? error : error.message;
  const stack = error instanceof Error ? error.stack : undefined;

  const logData = {
    category,
    message,
    context,
    stack,
    timestamp: new Date().toISOString(),
  };

  switch (severity) {
    case 'info':
      logger.info('ERROR_MESSAGES', message, logData);
      break;
    case 'warn':
      logger.warn('ERROR_MESSAGES', message, logData);
      break;
    default:
      logger.error('ERROR_MESSAGES', message, error instanceof Error ? error : undefined, logData);
  }
}
