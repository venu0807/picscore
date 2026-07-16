import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { scoreFace } from '@/lib/geometry';
import type { FaceLandmark } from '@/types';
import { checkRateLimit, getRateLimitKey } from '@/lib/rate-limit';
import { apiError } from '@/lib/error-handler';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  // Note: authenticated status logged after auth check
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      env.supabaseUrl,
      env.supabaseAnonKey,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value; },
          set(name, value, options) { cookieStore.set({ name, value, ...options }); },
          remove(name, options) { cookieStore.delete({ name, ...options }); },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    const isAuthenticated = !!user;
    logger.apiRequest('POST', '/api/score', { authenticated: isAuthenticated });

    // Determine rate limit tier
    let maxRequests = 1;
    let tier = 'free';
    let profile: { tier: string; scores_today: number; last_score_date: string; total_scores: number } | null = null;

    if (isAuthenticated) {
      const { data: p } = await supabase
        .from('profiles')
        .select('tier, scores_today, last_score_date, total_scores')
        .eq('id', user.id)
        .single();

      profile = p;
      tier = profile?.tier || 'free';
      if (tier !== 'free') maxRequests = 30;
    }

    // Distributed rate limit via Upstash Redis (falls back to in-memory)
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined;
    const key = await getRateLimitKey(user?.id, ip);
    const { allowed, remaining, resetAt } = await checkRateLimit(key, maxRequests);

    if (!allowed) {
      const isFreeUser = !isAuthenticated || tier === 'free';
      const durationMs = Date.now() - startTime;
      logger.apiResponse('POST', '/api/score', 429, durationMs, { key, remaining, tier });
      return NextResponse.json(
        {
          error: isFreeUser
            ? 'Free trial used (1 score/day). Sign in for unlimited!'
            : 'Rate limit exceeded. Try again shortly.',
          upgrade: isFreeUser,
          resetAt: new Date(resetAt).toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(maxRequests),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
          },
        }
      );
    }

    // Atomic DB rate limit for authenticated users
    if (isAuthenticated) {
      const today = new Date().toISOString().split('T')[0];
      const { data: count, error: rateError } = await supabase.rpc('increment_score_count', {
        user_id: user.id,
        today: today,
      });

      if (rateError) {
        // Fallback to in-memory when Supabase is unreachable
        const fallback = await checkRateLimit(`score:${user.id}`, 1);
        if (!fallback.allowed) {
          return NextResponse.json(
            { error: 'Rate limit reached. Try again later.' },
            { status: 429, headers: { 'X-RateLimit-Limit': '1', 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': new Date(fallback.resetAt).toISOString() } }
          );
        }
      } else {
        const scoresToday = count as number;
        const isFree = tier === 'free';

        if (isFree && scoresToday > 1) {
          // Rollback: decrement since we can't serve this request
          await supabase.rpc('decrement_score_count', { user_id: user.id, today });
          return NextResponse.json(
            { error: 'Free trial used (1 score/day). Sign in for unlimited!', upgrade: true, resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
            { status: 403, headers: { 'X-RateLimit-Limit': '1', 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() } }
          );
        }
      }
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }
    const file = formData.get('image') as File;
    const landmarksJson = formData.get('landmarks') as string;

    if (!file || !landmarksJson) {
      return NextResponse.json({ error: 'Missing image or landmarks' }, { status: 400 });
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type) || file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Invalid file (max 10MB, JPG/PNG/WebP)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let landmarks: { landmarks: number[][] };
    try {
      landmarks = JSON.parse(landmarksJson);
    } catch {
      return NextResponse.json({ error: 'Invalid landmarks JSON' }, { status: 400 });
    }

    const faceLandmarks: FaceLandmark[] = landmarks.landmarks.map(p => ({ x: p[0], y: p[1], z: p[2] }));

    let result;
    try {
      result = scoreFace(faceLandmarks);
    } catch {
      return NextResponse.json({ error: 'Face scoring failed' }, { status: 400 });
    }

    // For signed-in users: save to DB via RPC
    if (isAuthenticated) {
      const today = new Date().toISOString().split('T')[0];
      const scoresToday = profile?.last_score_date === today ? profile.scores_today : 0;
      const isFree = tier === 'free';

      // Enforce daily limit for free users (double-check)
      if (isFree && scoresToday >= 1) {
        return NextResponse.json(
          { error: 'Free trial used (1 score/day). Sign in for unlimited!', upgrade: true },
          { status: 429 }
        );
      }

      const fileName = `scores/${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: false });

      if (uploadError) {
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
      }

      // Use RPC for atomic score creation + counter update
      const { data: scoreData, error: rpcError } = await supabase.rpc('create_score', {
        p_user_id: user.id,
        p_image_url: fileName,
        p_landmarks_json: landmarks,
        p_result_json: result,
        p_is_watermarked: isFree,
        p_user_tier_at_time: tier,
      });

      if (rpcError) {
        // Clean up uploaded file on failure
        await supabase.storage.from('images').remove([fileName]);
        return NextResponse.json({ error: rpcError.message }, { status: 500 });
      }

      // Generate a signed URL for the stored image (accessible for 1 hour)
      const { data: signedUrl } = await supabase.storage
        .from('images')
        .createSignedUrl(fileName, 3600);

      const durationMs = Date.now() - startTime;
      logger.apiResponse('POST', '/api/score', 200, durationMs, { userId: user.id, tier, watermarked: isFree });

      return NextResponse.json({
        score: { result_json: result, card_url: signedUrl?.signedUrl || '', share_token: scoreData?.[0]?.share_token || '' },
        remainingToday: isFree ? 0 : null,
      });
    }

    // Anonymous — return score directly (rate limit handled above)
    const durationMs = Date.now() - startTime;
    logger.apiResponse('POST', '/api/score', 200, durationMs, { anonymous: true });
    return NextResponse.json({ score: { result_json: result } });

  } catch (e) {
    const durationMs = Date.now() - startTime;
    logger.apiError('POST', '/api/score', e instanceof Error ? e : new Error(String(e)));
    return apiError(e, 'POST /api/score');
  }
}
