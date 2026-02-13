import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Lazy construction: skip PrismaClient when DATABASE_URL is missing
// (happens during Trigger.dev Docker build indexing — env vars aren't available yet)
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    errorFormat: 'minimal',
  })
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? (
  process.env.DATABASE_URL
    ? createPrismaClient()
    : new Proxy({} as PrismaClient, {
        get(_, prop) {
          if (prop === 'then') return undefined
          throw new Error('DATABASE_URL not configured — cannot use database')
        },
      })
)

// In development, preserve single instance across hot reloads
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Track connection state
let isConnected = false
let connectionAttempts = 0
const MAX_CONNECTION_ATTEMPTS = 5

// Graceful shutdown - close connections on process termination
// Prevents "Connection refused" errors during restarts
const cleanup = async () => {
  try {
    logger.info('DATABASE', 'Disconnecting...')
    isConnected = false
    await prisma.$disconnect()
    logger.info('DATABASE', 'Disconnected successfully')
  } catch (error) {
    logger.error('DATABASE', 'Error during disconnect', error as Error)
  }
}

process.on('beforeExit', cleanup)
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

// Enhanced connection health check with exponential backoff
let isConnecting = false
async function ensureConnection(retryDelay = 1000) {
  if (isConnecting) {
    logger.info('DATABASE', 'Connection attempt already in progress')
    return
  }
  
  if (isConnected) {
    return
  }
  
  try {
    isConnecting = true
    connectionAttempts++
    
    logger.info('DATABASE', `Attempting connection (attempt ${connectionAttempts})...`)
    await prisma.$connect()
    
    // Test the connection with a simple query
    await prisma.$queryRaw`SELECT 1`
    
    isConnected = true
    connectionAttempts = 0 // Reset on success
    logger.info('DATABASE', 'Connected successfully')
    
  } catch (error: unknown) {
    logger.error('DATABASE', 'Connection error', error instanceof Error ? error : new Error(String(error)))
    isConnected = false
    
    // Exponential backoff for retries
    if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
      const nextDelay = Math.min(retryDelay * 2, 10000)
      logger.info('DATABASE', `Retrying in ${nextDelay}ms...`)
      setTimeout(() => {
        isConnecting = false
        ensureConnection(nextDelay)
      }, nextDelay)
    } else {
      logger.error('DATABASE', 'Max connection attempts reached. Manual intervention required.')
      connectionAttempts = 0 // Reset for future attempts
    }
  } finally {
    isConnecting = false
  }
}

// Note: Health check interval removed for serverless compatibility
// Prisma handles reconnection automatically on each request

// Initialize connection (skip when DATABASE_URL is missing, e.g. Trigger.dev indexing)
if (process.env.DATABASE_URL) {
  ensureConnection()
}

// Export connection utilities
export const dbHealth = {
  isConnected: () => isConnected,
  reconnect: () => ensureConnection(),
}
