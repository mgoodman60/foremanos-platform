/**
 * Centralized logging utility for ForemanOS
 *
 * Provides structured logging with context, timestamps, and metadata.
 * In production, this can be extended to send logs to external services.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMeta {
  [key: string]: unknown;
}

/**
 * Format log message with timestamp, level, context, and optional metadata
 */
function formatMessage(
  level: LogLevel,
  context: string,
  message: string,
  meta?: LogMeta
): string {
  const timestamp = new Date().toISOString();
  let metaStr = '';
  if (meta) {
    try {
      metaStr = ` ${JSON.stringify(meta)}`;
    } catch (error) {
      // Handle circular references or other JSON serialization errors
      metaStr = ` [Unable to serialize metadata: ${error instanceof Error ? error.message : String(error)}]`;
    }
  }
  return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}${metaStr}`;
}

/**
 * Logger utility with context-aware logging
 *
 * Usage:
 * ```typescript
 * import { logger } from '@/lib/logger';
 *
 * logger.info('FINALIZATION', 'Starting report finalization', { conversationId });
 * logger.error('ONEDRIVE', 'Upload failed', error, { fileName });
 * ```
 */
export const logger = {
  /**
   * Debug level - only logs in development
   */
  debug: (context: string, message: string, meta?: LogMeta): void => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatMessage('debug', context, message, meta));
    }
  },

  /**
   * Info level - general information
   */
  info: (context: string, message: string, meta?: LogMeta): void => {
    console.info(formatMessage('info', context, message, meta));
  },

  /**
   * Warning level - potential issues
   */
  warn: (context: string, message: string, meta?: LogMeta): void => {
    console.warn(formatMessage('warn', context, message, meta));
  },

  /**
   * Error level - errors and exceptions
   */
  error: (
    context: string,
    message: string,
    error?: Error | unknown,
    meta?: LogMeta
  ): void => {
    const errorMeta: LogMeta = error instanceof Error
      ? { errorMessage: error.message, stack: error.stack?.split('\n').slice(0, 3).join(' | ') }
      : error !== undefined
        ? { error: String(error) }
        : {};
    console.error(formatMessage('error', context, message, { ...errorMeta, ...meta }));
  },
};

/**
 * Create a scoped logger for a specific context
 *
 * Usage:
 * ```typescript
 * const log = createScopedLogger('FINALIZATION');
 * log.info('Starting process');
 * log.error('Failed', error);
 * ```
 */
export function createScopedLogger(context: string) {
  return {
    debug: (message: string, meta?: LogMeta) => logger.debug(context, message, meta),
    info: (message: string, meta?: LogMeta) => logger.info(context, message, meta),
    warn: (message: string, meta?: LogMeta) => logger.warn(context, message, meta),
    error: (message: string, error?: Error | unknown, meta?: LogMeta) =>
      logger.error(context, message, error, meta),
  };
}
