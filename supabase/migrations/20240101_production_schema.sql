-- =============================================================================
-- picscore — Supabase Production Database Schema
-- Run in Supabase SQL Editor
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- Profiles (extends auth.users)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    credits INTEGER DEFAULT 2,
    lifetime_credits INTEGER DEFAULT 2,
    stripe_customer_id TEXT,
    razorpay_customer_id TEXT,
    subscription_tier TEXT DEFAULT 'free', -- free, pro, enterprise
    subscription_status TEXT DEFAULT 'inactive',
    subscription_period_end TIMESTAMPTZ,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Scoring Results
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.scoring_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    image_url TEXT NOT NULL,
    image_path TEXT, -- Supabase Storage path
    scores JSONB NOT NULL, -- {overall, geometry, quality, lighting, technical, ...}
    landmarks JSONB, -- MediaPipe face landmarks
    analysis JSONB, -- Detailed breakdown
    face_shape TEXT,
    lighting_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_scoring_results_user_id ON public.scoring_results(user_id);
CREATE INDEX IF NOT EXISTS idx_scoring_results_created_at ON public.scoring_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scoring_results_token ON public.scoring_results(token);

-- =============================================================================
-- Payment Records
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    provider TEXT NOT NULL, -- 'stripe' or 'razorpay'
    provider_payment_id TEXT NOT NULL,
    provider_session_id TEXT,
    amount INTEGER NOT NULL, -- in smallest currency unit (paise/cents)
    currency TEXT NOT NULL DEFAULT 'INR',
    credits_purchased INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, succeeded, failed, refunded
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE(provider, provider_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_records_user_id ON public.payment_records(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_status ON public.payment_records(status);

-- =============================================================================
-- Credit Transactions (ledger)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- positive for credit, negative for debit
    balance_after INTEGER NOT NULL,
    type TEXT NOT NULL, -- purchase, usage, refund, bonus, admin_adjustment
    reference_id UUID, -- scoring_results.id or payment_records.id
    reference_type TEXT, -- 'scoring' | 'payment' | 'admin'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);

-- =============================================================================
-- Rate Limit Counters (for anonymous users via Supabase)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
    identifier TEXT PRIMARY KEY, -- IP address or session ID
    count INTEGER DEFAULT 0,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    last_reset TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Row Level Security Policies
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read/update own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Scoring Results: Users can read own results, anon can read via token
CREATE POLICY "Users can view own scoring results" ON public.scoring_results
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view result by token" ON public.scoring_results
    FOR SELECT USING (true); -- Token-based access is handled in API

CREATE POLICY "Service role can insert scoring results" ON public.scoring_results
    FOR INSERT WITH CHECK (true); -- API uses service role

-- Payment Records: Users can view own payments
CREATE POLICY "Users can view own payments" ON public.payment_records
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage payments" ON public.payment_records
    FOR ALL USING (auth.role() = 'service_role');

-- Credit Transactions: Users can view own
CREATE POLICY "Users can view own transactions" ON public.credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage transactions" ON public.credit_transactions
    FOR ALL USING (auth.role() = 'service_role');

-- Rate Limit: Only service role
CREATE POLICY "Service role manages rate limits" ON public.rate_limit_counters
    FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- Auto-update updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- Function: Create profile on signup
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, credits, lifetime_credits)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url', 2, 2);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- Function: Consume credit (atomic)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.consume_credit(p_user_id UUID, p_reference_id UUID, p_reference_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    -- Lock the profile row
    SELECT credits INTO v_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;

    IF v_balance <= 0 THEN
        RETURN FALSE;
    END IF;

    -- Decrement credit
    UPDATE public.profiles SET credits = credits - 1 WHERE id = p_user_id;

    -- Record transaction
    INSERT INTO public.credit_transactions (user_id, amount, balance_after, type, reference_id, reference_type, description)
    VALUES (p_user_id, -1, v_balance - 1, 'usage', p_reference_id, p_reference_type, 'Face scoring analysis');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Function: Add credits (after payment)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.add_credits(p_user_id UUID, p_amount INTEGER, p_payment_id UUID, p_description TEXT DEFAULT 'Credit purchase')
RETURNS VOID AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    SELECT credits INTO v_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;

    UPDATE public.profiles
    SET credits = credits + p_amount,
        lifetime_credits = lifetime_credits + p_amount
    WHERE id = p_user_id;

    INSERT INTO public.credit_transactions (user_id, amount, balance_after, type, reference_id, reference_type, description)
    VALUES (p_user_id, p_amount, v_balance + p_amount, 'purchase', p_payment_id, 'payment', p_description);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Function: Reset daily anonymous rate limit (run via pg_cron)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reset_daily_rate_limits()
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.rate_limit_counters
    WHERE last_reset < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;