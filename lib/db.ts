import { Pool, QueryResult } from '@neondatabase/serverless'

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL environment variable is not set. Please configure your Neon database connection in the Vars section.'
      )
    }

    pool = new Pool({ connectionString })
  }

  return pool
}

export const db = {
  async query<T = any>(
    text: string,
    values?: any[]
  ): Promise<QueryResult<T>> {
    const pool = getPool()
    try {
      const result = await pool.query<T>(text, values)
      return result
    } catch (error) {
      console.error('[db] Query error:', { text, error: String(error) })
      throw new Error(
        `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  },

  async transaction<T>(
    callback: (client: any) => Promise<T>
  ): Promise<T> {
    const pool = getPool()
    const client = await pool.connect()

    try {
      await client.query('BEGIN')
      const result = await callback(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },

  // Check if database is available
  async isAvailable(): Promise<boolean> {
    try {
      const pool = getPool()
      const result = await pool.query('SELECT 1')
      return !!result
    } catch {
      return false
    }
  },
}
