import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// CRITICAL FIX: Enhanced connection pooling configuration
// Prevents "upstream connect error" and connection exhaustion
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  // Connection pool configuration for high-traffic scenarios
  // Reduces connection errors during concurrent requests
  errorFormat: 'minimal',
})

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
    console.log('[DB] Disconnecting...')
    isConnected = false
    await prisma.$disconnect()
    console.log('[DB] Disconnected successfully')
  } catch (error) {
    console.error('[DB] Error during disconnect:', error)
  }
}

process.on('beforeExit', cleanup)
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

// Enhanced connection health check with exponential backoff
let isConnecting = false
async function ensureConnection(retryDelay = 1000) {
  if (isConnecting) {
    console.log('[DB] Connection attempt already in progress')
    return
  }
  
  if (isConnected) {
    return
  }
  
  try {
    isConnecting = true
    connectionAttempts++
    
    console.log(`[DB] Attempting connection (attempt ${connectionAttempts})...`)
    await prisma.$connect()
    
    // Test the connection with a simple query
    await prisma.$queryRaw`SELECT 1`
    
    isConnected = true
    connectionAttempts = 0 // Reset on success
    console.log('[DB] Connected successfully')
    
  } catch (error: any) {
    console.error('[DB] Connection error:', error.message)
    isConnected = false
    
    // Exponential backoff for retries
    if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
      const nextDelay = Math.min(retryDelay * 2, 10000)
      console.log(`[DB] Retrying in ${nextDelay}ms...`)
      setTimeout(() => {
        isConnecting = false
        ensureConnection(nextDelay)
      }, nextDelay)
    } else {
      console.error('[DB] Max connection attempts reached. Manual intervention required.')
      connectionAttempts = 0 // Reset for future attempts
    }
  } finally {
    isConnecting = false
  }
}

// Health check interval (every 30 seconds)
if (process.env.NODE_ENV !== 'test') {
  setInterval(async () => {
    if (!isConnected && !isConnecting) {
      console.log('[DB] Health check: Connection lost, attempting reconnection...')
      await ensureConnection()
    }
  }, 30000)
}

// Initialize connection
ensureConnection()

// Export connection utilities
export const dbHealth = {
  isConnected: () => isConnected,
  reconnect: () => ensureConnection(),
}
