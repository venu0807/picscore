-- Production-ready Supabase schema fixes for picscore
-- Run this in Supabase SQL Editor after initial schema

-- 1. Additional indexes for query performance
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON profiles(tier);
CREATE INDEX IF NOT EXISTS idx_scores_user_created ON scores(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_status ON scores(status);

-- 2. Fix storage RLS policies - restrict users to their own folders
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "selfies_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "selfies_select_own" ON storage.objects;
DROP POLICY IF EXISTS "selfies_delete_own" ON storage.objects;

-- Users can only insert into their own folder: selfies/{user_id}/*
CREATE POLICY "selfies_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'selfies'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'selfies'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Users can only select from their own folder
CREATE POLICY "selfies_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'selfies'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'selfies'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Users can delete their own files
CREATE POLICY "selfies_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'selfies'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'selfies'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- 3. Profile INSERT policy (was missing)
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. Add updated_at trigger for profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_updated ON profiles;
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. Ensure update_user_tier handles all cases
CREATE OR REPLACE FUNCTION public.update_user_tier(user_id UUID, new_tier TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Validate tier
  IF new_tier NOT IN ('free', 'pro', 'lifetime') THEN
    RAISE EXCEPTION 'Invalid tier: %', new_tier;
  END IF;

  UPDATE public.profiles SET tier = new_tier, updated_at = NOW() WHERE id = user_id;
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, tier) VALUES (user_id, new_tier);
  END IF;
END;
$$;

-- 6. Atomic rate limiting for scoring
CREATE OR REPLACE FUNCTION public.increment_score_count(user_id UUID, today DATE)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_count INT;
BEGIN
  INSERT INTO public.profiles (id, scores_today, last_score_date, total_scores)
  VALUES (user_id, 1, today, 1)
  ON CONFLICT (id) DO UPDATE SET
    scores_today = CASE
      WHEN profiles.last_score_date = today THEN profiles.scores_today + 1
      ELSE 1
    END,
    last_score_date = today,
    total_scores = profiles.total_scores + 1,
    updated_at = NOW()
  RETURNING scores_today INTO new_count;

  RETURN new_count;
END;
$$;

-- 7. Decrement for rollback on rate limit exceeded
CREATE OR REPLACE FUNCTION public.decrement_score_count(user_id UUID, today DATE)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
  SET scores_today = GREATEST(0, scores_today - 1),
      total_scores = GREATEST(0, total_scores - 1),
      updated_at = NOW()
  WHERE id = user_id AND last_score_date = today;
END;
$$;

-- 8. Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.increment_score_count(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_score_count(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_tier(UUID, TEXT) TO authenticated;

-- 9. Scores table: add tier check for rate limits
ALTER TABLE scores ADD COLUMN IF NOT EXISTS user_tier_at_time TEXT;

-- 10. Tier constraint validation
ALTER TABLE profiles ADD CONSTRAINT valid_tier
  CHECK (tier IN ('free', 'pro', 'lifetime')) NOT VALID;
ALTER TABLE profiles VALIDATE CONSTRAINT valid_tier;