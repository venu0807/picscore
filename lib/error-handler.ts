import { NextResponse } from 'next/server'

export function apiError(error: unknown, context: string): NextResponse {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error(`[API Error] ${context}:`, message)

  if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
    return NextResponse.json({ error: 'Request timed out. Please try again.' }, { status: 504 })
  }
  if (message.includes('rate limit') || message.includes('429')) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 })
  }

  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
