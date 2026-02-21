/**
 * Centralized logging utility for ForemanOS
 *
 * - Production: JSON lines ({ timestamp, level, scope, message, ...context })
 * - Development: human-readable colored console output
 * - Filterable via LOG_LEVEL env var (default: 'info' in prod, 'debug' in dev)
 * - No external dependencies
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isProd = process.env.NODE_ENV === 'production';

function getMinLevel(): number {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  if (envLevel && envLevel in LOG_LEVELS) {
    return LOG_LEVELS[envLevel];
  }
  return isProd ? LOG_LEVELS.info : LOG_LEVELS.debug;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= getMinLevel();
}

function serializeMeta(meta: LogContext): LogContext {
  const result: LogContext = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value instanceof Error) {
      result[key] = {
        message: value.message,
        stack: value.stack?.split('\n').slice(0, 3).join(' | '),
      };
    } else {
      result[key] = value;
    }
  }
  return result;
}

function log(level: LogLevel, scope: string, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return;

  if (isProd) {
    // JSON lines for production
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      scope,
      message,
    };
    if (context) {
      Object.assign(entry, serializeMeta(context));
    }
    try {
      const line = JSON.stringify(entry);
      // Use the appropriate console method for log routing
      switch (level) {
        case 'debug': console.debug(line); break;
        case 'info': console.info(line); break;
        case 'warn': console.warn(line); break;
        case 'error': console.error(line); break;
      }
    } catch {
      // Fallback if JSON serialization fails (circular refs, etc.)
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        scope,
        message: `[serialization failed] ${message}`,
      }));
    }
  } else {
    // Human-readable colored output for development
    let metaStr = '';
    if (context && Object.keys(context).length > 0) {
      try {
        metaStr = ` ${JSON.stringify(serializeMeta(context))}`;
      } catch {
        metaStr = ' [unable to serialize context]';
      }
    }
    const formatted = `[${level.toUpperCase()}] [${scope}] ${message}${metaStr}`;
    switch (level) {
      case 'debug': console.debug(formatted); break;
      case 'info': console.info(formatted); break;
      case 'warn': console.warn(formatted); break;
      case 'error': console.error(formatted); break;
    }
  }
}

/**
 * Logger with context as first parameter.
 *
 * Usage:
 * ```typescript
 * import { logger } from '@/lib/logger';
 * logger.info('STRIPE_WEBHOOK', 'Payment received', { amount: 100 });
 * logger.error('AUTH', 'Login failed', error, { userId });
 * ```
 */
export const logger = {
  debug: (scope: string, message: string, meta?: LogContext): void => {
    log('debug', scope, message, meta);
  },
  info: (scope: string, message: string, meta?: LogContext): void => {
    log('info', scope, message, meta);
  },
  warn: (scope: string, message: string, meta?: LogContext): void => {
    log('warn', scope, message, meta);
  },
  error: (
    scope: string,
    message: string,
    error?: Error | unknown,
    meta?: LogContext
  ): void => {
    const errorMeta: LogContext = error instanceof Error
      ? { errorMessage: error.message, stack: error.stack?.split('\n').slice(0, 3).join(' | ') }
      : error !== undefined
        ? { error: String(error) }
        : {};
    log('error', scope, message, { ...errorMeta, ...meta });
  },
};

/**
 * Create a scoped logger for a specific context.
 *
 * Usage:
 * ```typescript
 * import { createLogger } from '@/lib/logger';
 * const logger = createLogger('stripe-webhook');
 * logger.info('Payment received', { amount: 100 });
 * logger.error('Processing failed', error, { eventId });
 * ```
 */
export function createLogger(scope: string) {
  return {
    debug: (message: string, meta?: LogContext) => log('debug', scope, message, meta),
    info: (message: string, meta?: LogContext) => log('info', scope, message, meta),
    warn: (message: string, meta?: LogContext) => log('warn', scope, message, meta),
    error: (message: string, error?: Error | unknown, meta?: LogContext) => {
      const errorMeta: LogContext = error instanceof Error
        ? { errorMessage: error.message, stack: error.stack?.split('\n').slice(0, 3).join(' | ') }
        : error !== undefined
          ? { error: String(error) }
          : {};
      log('error', scope, message, { ...errorMeta, ...meta });
    },
  };
}

/** @deprecated Use createLogger instead */
export const createScopedLogger = createLogger;
