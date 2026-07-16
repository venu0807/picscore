-- Run this in Supabase SQL Editor

-- profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  age INTEGER,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'lifetime')),
  scores_today INTEGER DEFAULT 0,
  last_score_date DATE DEFAULT CURRENT_DATE,
  total_scores INTEGER DEFAULT 0,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- scores table
CREATE TABLE scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  landmarks_json JSONB NOT NULL,
  result_json JSONB NOT NULL,
  share_token TEXT UNIQUE,
  is_watermarked BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_scores_user_created ON scores(user_id, created_at DESC);
CREATE INDEX idx_scores_share_token ON scores(share_token);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own scores" ON scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own score" ON scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "public shared scores" ON scores FOR SELECT USING (share_token IS NOT NULL);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS — without these, authenticated uploads 403
CREATE POLICY "images_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = 'scores' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "images_select_own" ON storage.objects
  FOR SELECT USING (bucket_id = 'images' AND owner_id = auth.uid());

CREATE POLICY "images_delete_own" ON storage.objects
  FOR DELETE USING (bucket_id = 'images' AND owner_id = auth.uid());

-- RLS helper: allow service role to bypass (for webhooks/webhooks)
-- GRANT ALL ON profiles TO service_role;
-- GRANT ALL ON scores TO service_role;

-- RPC: Update user tier (called by Stripe/Razorpay webhooks)
CREATE OR REPLACE FUNCTION update_user_tier(user_id UUID, new_tier TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles SET tier = new_tier WHERE id = user_id;
END;
$$;

-- RPC: Create score with atomic counter update (called by /api/score)
CREATE OR REPLACE FUNCTION create_score(
  p_user_id UUID,
  p_image_url TEXT,
  p_landmarks_json JSONB,
  p_result_json JSONB,
  p_is_watermarked BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (id UUID, share_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_share_token TEXT;
  v_today DATE := CURRENT_DATE;
  v_scores_today INT;
  v_tier TEXT;
BEGIN
  -- Check user tier and daily limit
  SELECT tier, scores_today, last_score_date INTO v_tier, v_scores_today, v_last_score_date
  FROM profiles WHERE id = p_user_id;

  IF v_tier = 'free' AND v_last_score_date = v_today AND v_scores_today >= 1 THEN
    RAISE EXCEPTION 'Daily free limit reached';
  END IF;

  -- Generate share token for public sharing
  v_share_token := encode(gen_random_bytes(16), 'hex');

  -- Insert score
  INSERT INTO scores (user_id, image_url, landmarks_json, result_json, share_token, is_watermarked)
  VALUES (p_user_id, p_image_url, p_landmarks_json, p_result_json, v_share_token, p_is_watermarked)
  RETURNING id INTO v_id;

  -- Update profile counters atomically
  UPDATE profiles SET
    scores_today = CASE
      WHEN last_score_date = v_today THEN scores_today + 1
      ELSE 1
    END,
    last_score_date = v_today,
    total_scores = total_scores + 1
  WHERE id = p_user_id;

  RETURN QUERY SELECT v_id, v_share_token;
END;
$$;

-- RPC: Get user's score history
CREATE OR REPLACE FUNCTION get_user_scores(p_user_id UUID, p_limit INT DEFAULT 50)
RETURNS SETOF scores
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM scores
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$$;

-- RPC: Get single score by share token (public)
CREATE OR REPLACE FUNCTION get_shared_score(p_share_token TEXT)
RETURNS SETOF scores
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM scores WHERE share_token = p_share_token;
END;
$$;

-- Daily reset (run via pg_cron or middleware)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('reset-daily-scores', '0 0 * * *',
--   'UPDATE profiles SET scores_today = 0, last_score_date = CURRENT_DATE');

-- Used by stripe-webhook and razorpay-webhook to update user tier after payment
CREATE OR REPLACE FUNCTION update_user_tier(user_id UUID, new_tier TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles SET tier = new_tier WHERE id = user_id;
END;
$$;