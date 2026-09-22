-- ===========================================================================
-- MEBODY — 초대 발송을 기록한다 (전문가 확장 주지표의 분모)
--
-- ※ db/journey 폴더의 068 입니다.
--
-- ── 왜 필요한가
-- 로드맵의 Phase 1 주지표는 `professional_result_viewed / invite_sent` 입니다.
-- "초대한 고객 중 결과까지 본 비율" 이고, 이 값이 30% 미만이면 Phase 2 이후를 멈춥니다.
--
-- 분자(결과 열람)는 professional_activity_log 의 client_opened 로 이미 쌓고 있는데
-- **분모(초대 발송)를 안 쌓고 있었습니다.** 나눌 수가 없으면 멈출지 말지를 정할 수 없습니다.
--
-- ── 왜 analytics_events 가 아닌가
-- analytics_events(054)는 개인 식별 값을 일부러 넣지 않는 테이블입니다. 이 지표는
-- "어느 전문가가" 를 알아야 세므로 professional_activity_log 를 씁니다(056·059 와 같은 자리).
--
-- 선행: 056 · 059 적용 완료
-- ===========================================================================

ALTER TABLE public.professional_activity_log DROP CONSTRAINT IF EXISTS professional_activity_log_event_check;
ALTER TABLE public.professional_activity_log ADD CONSTRAINT professional_activity_log_event_check
  CHECK (event IN ('client_opened', 'activity_viewed', 'assignment_created', 'assignment_cancelled',
                   'invite_sent'));

/**
 * 초대를 만들면서 발송 기록을 함께 남깁니다.
 *
 * 059 의 배정처럼 함수 안에서 같이 씁니다. 서버가 따로 INSERT 하게 두면 한쪽만 성공하는
 * 순간이 생기고, 그러면 지표가 조용히 어긋납니다.
 */
CREATE OR REPLACE FUNCTION public.create_client_invite()
RETURNS TABLE(relation_id uuid, invite_token text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pro   uuid := public.current_professional_id();
  v_token text;
  v_row   public.professional_clients%ROWTYPE;
BEGIN
  IF v_pro IS NULL THEN
    RAISE EXCEPTION '전문가 계정만 초대할 수 있습니다' USING ERRCODE = '42501';
  END IF;

  -- 추측할 수 없는 토큰. gen_random_bytes 는 pgcrypto 확장이라 이 프로젝트에 없어서,
  -- gen_random_uuid() 세 개를 이어 붙입니다(무작위 96비트 × 3 = 288비트).
  -- 서버가 만들던 32바이트(256비트)보다 큽니다.
  v_token := translate(
    encode(convert_to(
      replace(gen_random_uuid()::text || gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'UTF8'), 'base64'),
    E'+/=\n', '-_');

  INSERT INTO public.professional_clients (professional_id, invite_token)
  VALUES (v_pro, v_token)
  RETURNING * INTO v_row;

  INSERT INTO public.professional_activity_log (professional_id, client_user_id, event)
  VALUES (v_pro, NULL, 'invite_sent');

  RETURN QUERY SELECT v_row.id, v_row.invite_token, v_row.expires_at;
END $$;

COMMENT ON FUNCTION public.create_client_invite() IS
  '초대 생성 + 발송 기록. 주지표(결과 열람 / 초대 발송)의 분모를 같은 트랜잭션에서 남긴다.';

REVOKE ALL ON FUNCTION public.create_client_invite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_client_invite() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------------
SELECT has_function_privilege('authenticated', 'public.create_client_invite()', 'EXECUTE') AS "회원_실행(true여야)",
       has_function_privilege('anon', 'public.create_client_invite()', 'EXECUTE')          AS "익명_실행(false여야)";

SELECT pg_get_constraintdef(oid) AS "허용 이벤트"
  FROM pg_constraint WHERE conname = 'professional_activity_log_event_check';
