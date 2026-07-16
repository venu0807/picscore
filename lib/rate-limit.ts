// ponytail: distributed rate limiting via Upstash Redis. Falls back to in-memory Map when Redis is unavailable.
// Upgrade to persistent Redis when scaling beyond single instance.

import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

// Upstash clients (lazy init)
let redis: Redis | null = null
let ratelimit: Ratelimit | null = null

function getRedis() {
  if (!redis && env.upstashRedisUrl && env.upstashRedisToken) {
    redis = new Redis({ url: env.upstashRedisUrl, token: env.upstashRedisToken })
  }
  return redis
}

function getRatelimit(max: number) {
  if (!ratelimit && env.upstashRedisUrl && env.upstashRedisToken) {
    const r = getRedis()
    if (r) {
      ratelimit = new Ratelimit({
        redis: r,
        limiter: Ratelimit.slidingWindow(max, '1 m'),
        analytics: true,
      })
    }
  }
  return ratelimit
}

type RateLimitEntry = { count: number; resetAt: number }

// In-memory fallback store
const memoryStore = new Map<string, RateLimitEntry>()

const WINDOW_MS = 60_000  // 1 minute window

// Clean old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of memoryStore) {
      if (now > entry.resetAt) memoryStore.delete(key)
    }
  }, 300_000)
}

export async function checkRateLimit(key: string, max: number): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  // Try Upstash Redis first
  const rl = getRatelimit(max)
  if (rl) {
    try {
      const result = await rl.limit(key)
      logger.debug('Rate limit check (Redis)', { key, allowed: result.success, remaining: result.remaining })
      return {
        allowed: result.success,
        remaining: result.remaining,
        resetAt: Date.now() + WINDOW_MS,
      }
    } catch (e) {
      logger.warn('Redis rate limit failed, falling back to memory', { key, error: e instanceof Error ? e.message : 'Unknown' })
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  const now = Date.now()
  const entry = memoryStore.get(key)

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: max - 1, resetAt: now + WINDOW_MS }
  }

  entry.count++
  const allowed = entry.count <= max
  logger.debug('Rate limit check (memory)', { key, allowed, remaining: Math.max(0, max - entry.count) })
  return { allowed, remaining: Math.max(0, max - entry.count), resetAt: entry.resetAt }
}

export async function getRateLimitKey(userId?: string | null, ip?: string): Promise<string> {
  if (userId) return `auth:${userId}`
  // Use IP-based key for anonymous
  return `anon:${ip || 'unknown'}`
}
