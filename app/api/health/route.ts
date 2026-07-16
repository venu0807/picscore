// app/api/health/route.ts — Enhanced health checks with Redis, DB, Sentry
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function checkDatabase(): Promise<'ok' | 'error'> {
  try {
    const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey)
    const { error } = await supabase.from('profiles').select('count').limit(1)
    if (error) {
      logger.error('Database health check failed', { error: error.message, code: error.code, hint: error.hint })
      return 'error'
    }
    return 'ok'
  } catch (e) {
    logger.error('Database health check threw', { error: e instanceof Error ? e.message : String(e) })
    return 'error'
  }
}

async function checkRedis(): Promise<'ok' | 'error' | 'unconfigured'> {
  try {
    if (!env.upstashRedisUrl || !env.upstashRedisToken) return 'unconfigured'
    const redis = new Redis({ url: env.upstashRedisUrl, token: env.upstashRedisToken })
    await redis.ping()
    return 'ok'
  } catch {
    return 'error'
  }
}

async function checkSentry(): Promise<'ok' | 'error'> {
  try {
    // Basic DSN validation
    if (!env.sentryDsn || !env.sentryDsn.startsWith('https://')) return 'error'
    return 'ok'
  } catch {
    return 'error'
  }
}

export async function GET() {
  const start = Date.now()
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkSentry(),
  ])

  const services = {
    database: checks[0].status === 'fulfilled' ? checks[0].value : 'error',
    redis: checks[1].status === 'fulfilled' ? checks[1].value : 'error',
    sentry: checks[2].status === 'fulfilled' ? checks[2].value : 'error',
  }

  const healthy = Object.values(services).every(s => s === 'ok' || s === 'unconfigured')
  const latencyMs = Date.now() - start

  logger.info('Health check completed', { services, latencyMs, healthy })

  return NextResponse.json(
    { status: healthy ? 'healthy' : 'degraded', services, latencyMs },
    { status: healthy ? 200 : 503 }
  )
}