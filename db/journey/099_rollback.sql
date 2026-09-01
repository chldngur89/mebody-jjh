-- MEBODY Journey — 롤백
--
-- 020~023 으로 만든 것만 되돌립니다. 기존 테이블의 컬럼과 행은 건드리지 않습니다.
-- 사용자 데이터(진행 중 저니·미션·피드백·리포트)가 함께 삭제되므로 운영 중이라면 신중히.

BEGIN;

-- 자식 -> 부모 순서
DROP TABLE IF EXISTS public.journey_reports          CASCADE;
DROP TABLE IF EXISTS public.journey_mission_feedback CASCADE;
DROP TABLE IF EXISTS public.user_missions            CASCADE;
DROP TABLE IF EXISTS public.user_journeys            CASCADE;
DROP TABLE IF EXISTS public.journey_content_tags     CASCADE;
DROP TABLE IF EXISTS public.journey_templates        CASCADE;

-- 032 주문 · 멤버십
DROP FUNCTION IF EXISTS public.create_order(jsonb, integer);
DROP FUNCTION IF EXISTS public.cancel_order(uuid);
DROP TABLE IF EXISTS public.order_items        CASCADE;
DROP TABLE IF EXISTS public.orders             CASCADE;
DROP TABLE IF EXISTS public.user_subscriptions CASCADE;
DROP TABLE IF EXISTS public.membership_plans   CASCADE;

-- 031 적립금
DROP FUNCTION IF EXISTS public.reward_multiplier_for(uuid);
DROP FUNCTION IF EXISTS public.reward_balance(uuid);
DROP FUNCTION IF EXISTS public.claim_mission_reward(uuid);
DROP FUNCTION IF EXISTS public.claim_journey_reward(uuid);
DROP FUNCTION IF EXISTS public.draw_reward_amount(text);
DROP TABLE IF EXISTS public.user_rewards  CASCADE;
DROP TABLE IF EXISTS public.reward_rules  CASCADE;

-- 020·030 이 기존 테이블에 추가한 것
DROP INDEX IF EXISTS public.immediate_action_content_content_key_uidx;
ALTER TABLE public.immediate_action_content
  DROP COLUMN IF EXISTS release_image_url,
  DROP COLUMN IF EXISTS stretch_image_url;

COMMIT;

-- 되돌리지 않는 것 (020 이 만들지 않았거나 다른 마이그레이션 소유)
--   public.set_updated_at()          — supabase_v1_foundation.sql 이 먼저 만든 공용 함수
--   missions / user_mission_progress — Spring JPA 소유, 애초에 손대지 않음
--   immediate_action_* 의 컬럼·행     — 변경한 적 없음
