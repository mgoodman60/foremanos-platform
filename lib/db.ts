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

// Graceful shutdown - close connections on process termination
// Prevents "Connection refused" errors during restarts
const cleanup = async () => {
  try {
    logger.info('DATABASE', 'Disconnecting...')
    await prisma.$disconnect()
    logger.info('DATABASE', 'Disconnected successfully')
  } catch (error) {
    logger.error('DATABASE', 'Error during disconnect', error as Error)
  }
}

process.on('beforeExit', cleanup)
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

// Note: Prisma handles connection pooling and reconnection automatically
// on each request in serverless environments. No manual ensureConnection() needed.
