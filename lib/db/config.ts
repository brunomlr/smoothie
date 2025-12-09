import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL

// Serverless-friendly connection pool with singleton pattern
// This prevents creating multiple pools in serverless environments
let cachedPool: Pool | null = null

function getPool(): Pool | null {
  if (!DATABASE_URL) {
    return null
  }

  // In serverless environments, reuse existing pool if available
  if (cachedPool) {
    return cachedPool
  }
  // Create new pool with serverless-optimized settings
  cachedPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // Required for Neon
    },
    // Serverless-optimized settings for Neon
    max: 10, // Increased for better concurrency (Neon handles pooling server-side)
    min: 0, // Don't maintain idle connections in serverless
    idleTimeoutMillis: 10000, // Release idle connections faster (10s)
    connectionTimeoutMillis: 10000, // Fail fast on connection issues (10s)
    // Query timeout to prevent long-running queries
    statement_timeout: 30000, // 30s max query time
    // Allow graceful termination
    allowExitOnIdle: true,
  })

  return cachedPool
}

// Export the pool getter
export const pool = getPool()

// Handle pool errors silently in production
if (pool) {
  pool.on('error', () => {
    // Pool error - will be handled by query-level error handling
  })
}

// Helper function to test connection
export async function testConnection(): Promise<boolean> {
  if (!pool) {
    return false
  }

  try {
    const client = await pool.connect()
    await client.query('SELECT NOW()')
    client.release()
    return true
  } catch {
    return false
  }
}

// Graceful shutdown
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
  }
}
