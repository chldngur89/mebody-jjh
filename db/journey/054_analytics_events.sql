-- ===========================================================================
-- MEBODY — 최소 이벤트 수집
--
-- ※ db/journey 폴더의 054 입니다.
--
-- 왜 필요한가: src/lib/analytics.ts 는 인터페이스만 있고 아무것도 보내지 않습니다.
-- 그래서 공유가 쓰이는지, 전문가가 결과를 보는지, 진단을 어디서 그만두는지 전부
-- 물어볼 수밖에 없습니다. 그건 검증이 아닙니다.
--
-- 왜 이 모양인가:
--   app_error_log(db/v1/050·051, journey/048)와 같은 패턴입니다.
--   앱이 Supabase 에 직접 INSERT 하고, 읽기는 관리자만 합니다.
--   Spring 서버를 거치지 않으므로 서버가 없어도 앱이 그대로 동작합니다.
--
-- ★ 개인 식별 값을 넣지 않습니다.
--   user_id 컬럼이 없습니다. 있으면 개인정보가 되어 처리방침·파기 대상이 되고,
--   탈퇴할 때 지워야 할 곳이 하나 더 늘어납니다.
--   대신 session_id 로 한 번의 방문 안에서만 이어 봅니다. 브라우저를 닫으면 끊깁니다.
--   props 에 무엇이 들어갈 수 있는지는 analytics.ts 의 타입이 막고 있습니다
--   (body_code · share_channel · ref · reason).
--
-- 선행: 053 적용 완료
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  event       text NOT NULL,
  props       jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- 한 번의 방문을 잇는 임시 값. 사람을 식별하지 않습니다.
  session_id  text,
  -- 쿼리스트링은 넣지 않습니다. 결과 id 가 들어갑니다.
  path        text,
  app_version text
);

CREATE INDEX IF NOT EXISTS analytics_events_event_time_idx
  ON public.analytics_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_session_idx
  ON public.analytics_events (session_id, created_at);

COMMENT ON TABLE public.analytics_events IS
  '퍼널 확인용 이벤트. 개인 식별 값을 넣지 않는다(user_id 컬럼이 없다). session_id 는 방문 단위 임시값.';

-- ---------------------------------------------------------------------------
-- 쏟아지는 것을 막습니다 — app_error_log 와 같은 방식
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_events_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  recent integer;
BEGIN
  -- 같은 세션이 1분에 같은 이벤트를 60번 넘게 보내면 버립니다.
  -- 앱에 오류를 돌려주지 않습니다. 수집이 화면을 막으면 안 됩니다.
  IF new.session_id IS NOT NULL THEN
    SELECT count(*) INTO recent
      FROM public.analytics_events
     WHERE session_id = new.session_id
       AND event = new.event
       AND created_at > now() - interval '1 minute';
    IF recent >= 60 THEN RETURN NULL; END IF;
  END IF;

  -- 오래된 것은 남겨둘 이유가 없습니다.
  DELETE FROM public.analytics_events WHERE created_at < now() - interval '180 days';

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS analytics_events_rate_limit_trg ON public.analytics_events;
CREATE TRIGGER analytics_events_rate_limit_trg
  BEFORE INSERT ON public.analytics_events
  FOR EACH ROW EXECUTE FUNCTION public.analytics_events_rate_limit();

-- ---------------------------------------------------------------------------
-- RLS — 아무나 남기고, 관리자만 읽습니다
-- ---------------------------------------------------------------------------
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analytics_events_insert_any ON public.analytics_events;
CREATE POLICY analytics_events_insert_any ON public.analytics_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS analytics_events_select_admin ON public.analytics_events;
CREATE POLICY analytics_events_select_admin ON public.analytics_events
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- 권한 — 기본값(GRANT ALL)에는 TRUNCATE 가 들어 있고 TRUNCATE 는 RLS 를 우회합니다
--        041(payments)·048(app_error_log)에서 같은 일이 있었습니다.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.analytics_events FROM anon, authenticated;

GRANT INSERT         ON public.analytics_events TO anon, authenticated;
GRANT SELECT         ON public.analytics_events TO authenticated;
GRANT ALL PRIVILEGES ON public.analytics_events TO service_role;

REVOKE ALL ON FUNCTION public.analytics_events_rate_limit() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------------
SELECT grantee AS 역할, string_agg(privilege_type, ',' ORDER BY privilege_type) AS 권한
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name = 'analytics_events'
   AND grantee IN ('anon', 'authenticated')
 GROUP BY grantee ORDER BY grantee;

SELECT count(*)::int AS "앱 역할에 TRUNCATE 가 열린 테이블(0이어야)"
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND privilege_type = 'TRUNCATE'
   AND grantee IN ('anon', 'authenticated');

SELECT count(*)::int AS "user_id 컬럼(0이어야)"
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'user_id';
