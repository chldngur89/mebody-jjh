-- mebody: 회원가입/재방문 자동 결과/멤버십 결제(테스트)용 SQL
-- 실행 위치: Supabase SQL Editor
-- 실행 순서: 전체 복사 후 한 번에 Run

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 공통 updated_at 트리거 함수
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1) 설문 응답에 auth 사용자 연결 컬럼 추가 (재방문 빠른 결과 조회용)
ALTER TABLE public.questionnaire_responses
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS questionnaire_responses_user_id_idx
  ON public.questionnaire_responses (user_id, completed_at DESC);

-- 2) 사용자 프로필
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'user_profiles select own'
  ) THEN
    CREATE POLICY "user_profiles select own"
      ON public.user_profiles FOR SELECT
      USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'user_profiles insert own'
  ) THEN
    CREATE POLICY "user_profiles insert own"
      ON public.user_profiles FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'user_profiles update own'
  ) THEN
    CREATE POLICY "user_profiles update own"
      ON public.user_profiles FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) 멤버십 플랜 마스터
CREATE TABLE IF NOT EXISTS public.membership_plans (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly', 'one_time')),
  price_krw INT NOT NULL CHECK (price_krw >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'membership_plans' AND policyname = 'membership_plans read'
  ) THEN
    CREATE POLICY "membership_plans read"
      ON public.membership_plans FOR SELECT
      USING (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS membership_plans_updated_at ON public.membership_plans;
CREATE TRIGGER membership_plans_updated_at
BEFORE UPDATE ON public.membership_plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.membership_plans (code, name, description, billing_cycle, price_krw, is_active, sort_order)
VALUES
  ('basic_monthly', 'Basic Monthly', '결과 저장, 히스토리 조회, 재방문 빠른 결과', 'monthly', 5900, true, 1),
  ('pro_monthly', 'Pro Monthly', 'Basic + 심화 리포트 + 루틴 우선순위', 'monthly', 12900, true, 2)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  billing_cycle = EXCLUDED.billing_cycle,
  price_krw = EXCLUDED.price_krw,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- 4) 사용자 구독 상태
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL REFERENCES public.membership_plans(code),
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_subscriptions_user_id_idx
  ON public.user_subscriptions (user_id);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_subscriptions' AND policyname = 'user_subscriptions select own'
  ) THEN
    CREATE POLICY "user_subscriptions select own"
      ON public.user_subscriptions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_subscriptions' AND policyname = 'user_subscriptions insert own'
  ) THEN
    CREATE POLICY "user_subscriptions insert own"
      ON public.user_subscriptions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_subscriptions' AND policyname = 'user_subscriptions update own'
  ) THEN
    CREATE POLICY "user_subscriptions update own"
      ON public.user_subscriptions FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER user_subscriptions_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;

