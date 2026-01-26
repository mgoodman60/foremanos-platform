import { prisma } from './db';

const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
};

function isRetryableError(error: any): boolean {
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.code || '';
  
  return (
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('upstream') ||
    errorMessage.includes('reset') ||
    errorCode === 'P2024' ||
    errorCode === 'P1001' ||
    errorCode === 'P1002' ||
    errorCode === 'P1008' ||
    errorCode === 'P1017'
  );
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string = 'database operation',
  retries: number = RETRY_CONFIG.maxRetries
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isRetryableError(error) && retries > 0) {
      const delay = RETRY_CONFIG.retryDelay * Math.pow(
        RETRY_CONFIG.backoffMultiplier,
        RETRY_CONFIG.maxRetries - retries
      );
      
      console.warn(`[DB] Retry ${operationName} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      try {
        await prisma.$connect();
      } catch (e) {
        console.error('[DB] Reconnect failed');
      }
      
      return withRetry(operation, operationName, retries - 1);
    }
    
    throw error;
  }
}

export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: string = 'database operation',
  defaultValue?: T
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    console.error(`[DB] ${operationName} failed:`, error);
    return defaultValue;
  }
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    return false;
  }
}
