-- ===========================================================================
-- MEBODY — 전문가가 고객에게 미션을 배정한다 (전문가 확장 Phase 3)
--
-- ※ db/journey 폴더의 059 입니다.
--
-- 052·053 이 "누구를 볼 수 있는가", 056 이 "무엇을 했는가" 였다면
-- 여기는 **"무엇을 하게 할 것인가"** 입니다. 남의 앱에 할 일을 넣는 기능이라
-- 앞의 둘보다 위험합니다. 그래서 세 가지를 못 박습니다.
--
-- ── 1. 내용은 만들 수 없고 고를 수만 있습니다
-- 전문가가 동작 설명을 직접 써 넣게 하면, 그 순간 이 앱은 남의 몸에 대한 지시를
-- 검증 없이 나르는 통로가 됩니다. 의료 행위가 아니라고 적어 둔 것과 어긋납니다.
-- 그래서 배정은 **immediate_action_content 에 이미 있는 23개 중 고르기**만 됩니다.
-- 덧붙일 수 있는 것은 짧은 메모 한 줄뿐입니다(200자).
--
-- ── 2. 적립금은 그대로 대상입니다. 안전한 이유는 057 입니다
-- claim_mission_reward 가 미션 완료로 적립금을 줍니다. 전문가가 미션을 만들 수 있게 되면
-- 발급 경로가 열리는 셈인데, **057 의 월 상한(49원)이 트리거로 막고 있습니다.**
-- 전문가가 미션을 100개 만들어도 그 고객의 한 달 무료 적립은 49원을 넘지 못합니다.
-- 그래서 "전문가가 배정한 미션은 적립 제외" 같은 예외를 두지 않습니다 —
-- 예외를 두면 고객이 트레이너 숙제를 할수록 손해를 보는 이상한 구조가 됩니다.
--
-- ── 3. 쏟아붓기를 막습니다
-- 한 고객에게 하루 3개까지만 배정할 수 있습니다. 제한이 없으면 앱이 숙제 창고가 되고,
-- 고객이 앱을 지우는 쪽으로 갑니다.
--
-- 통과 조건은 053·056 과 **똑같습니다**: 활성 전문가 · ACTIVE 관계 · 고객 동의.
-- 다만 여기서는 0행이 아니라 **예외**를 던집니다. 읽기는 "없다" 로 끝나도 되지만
-- 쓰기는 실패했다는 걸 호출부가 알아야 하기 때문입니다.
--
-- 선행: 052 · 053 · 056 · 057 적용 완료
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) 미션에 "누가 배정했는가" 와 "뭐라고 했는가"
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_missions
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES public.professionals(id) ON DELETE SET NULL;

ALTER TABLE public.user_missions
  ADD COLUMN IF NOT EXISTS prescription jsonb;

COMMENT ON COLUMN public.user_missions.assigned_by IS
  '이 미션을 배정한 전문가. NULL 이면 앱이 자동으로 배정한 것이다. 전문가가 탈퇴해도 미션은 남는다(SET NULL).';
COMMENT ON COLUMN public.user_missions.prescription IS
  '전문가가 덧붙인 메모. {note, assigned_at}. 동작 내용은 여기 넣지 않는다 — 콘텐츠는 라이브러리에서만 고른다.';

CREATE INDEX IF NOT EXISTS user_missions_assigned_by_idx
  ON public.user_missions (assigned_by, created_at DESC) WHERE assigned_by IS NOT NULL;

-- 활동 로그에 배정을 더합니다(056 의 CHECK 를 넓힙니다).
ALTER TABLE public.professional_activity_log DROP CONSTRAINT IF EXISTS professional_activity_log_event_check;
ALTER TABLE public.professional_activity_log ADD CONSTRAINT professional_activity_log_event_check
  CHECK (event IN ('client_opened', 'activity_viewed', 'assignment_created', 'assignment_cancelled'));

-- ---------------------------------------------------------------------------
-- 2) 배정
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_client_mission(
  p_client_user_id uuid,
  p_content_key    text,
  p_note           text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pro        uuid := public.current_professional_id();
  v_journey    public.user_journeys%ROWTYPE;
  v_content    public.immediate_action_content%ROWTYPE;
  v_today      integer;
  v_slot       integer;
  v_mission    uuid;
  v_note       text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
  IF v_pro IS NULL THEN
    RAISE EXCEPTION '전문가 계정만 배정할 수 있습니다' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.professional_clients pc
     WHERE pc.professional_id = v_pro
       AND pc.client_user_id  = p_client_user_id
       AND pc.status          = 'ACTIVE'
       AND pc.consented_at IS NOT NULL
  ) THEN
    -- 관계가 없거나 동의가 없습니다. 읽기와 달리 쓰기는 실패를 알려야 합니다.
    RAISE EXCEPTION '내 고객이 아니거나 아직 동의하지 않았습니다' USING ERRCODE = '42501';
  END IF;

  -- 내용은 라이브러리에서만. 전문가가 동작 설명을 써 넣을 수 없습니다.
  SELECT * INTO v_content FROM public.immediate_action_content WHERE content_key = p_content_key;
  IF v_content.content_key IS NULL THEN
    RAISE EXCEPTION '없는 콘텐츠입니다' USING ERRCODE = '22023';
  END IF;

  IF length(coalesce(v_note, '')) > 200 THEN
    RAISE EXCEPTION '메모는 200자까지입니다' USING ERRCODE = '22001';
  END IF;

  -- 붙일 저니가 있어야 합니다. 없으면 고객이 아직 루틴을 시작하지 않은 것입니다.
  SELECT * INTO v_journey
    FROM public.user_journeys j
   WHERE j.user_id = p_client_user_id AND j.status = 'active'
   ORDER BY j.last_active_at DESC NULLS LAST, j.started_at DESC
   LIMIT 1;

  IF v_journey.id IS NULL THEN
    RAISE EXCEPTION '고객이 진행 중인 루틴이 없습니다' USING ERRCODE = '42501';
  END IF;

  -- 쏟아붓기 방지: 한 고객에게 하루 3개까지.
  SELECT count(*) INTO v_today
    FROM public.user_missions m
   WHERE m.user_id = p_client_user_id
     AND m.assigned_by = v_pro
     AND m.created_at >= date_trunc('day', (now() AT TIME ZONE 'Asia/Seoul')) AT TIME ZONE 'Asia/Seoul';

  IF v_today >= 3 THEN
    RAISE EXCEPTION '한 고객에게 하루 3개까지 배정할 수 있습니다' USING ERRCODE = '54000';
  END IF;

  -- 오늘 자리의 맨 뒤에 붙입니다. 앱의 오늘 화면은 손대지 않아도 그대로 보입니다.
  SELECT coalesce(max(m.slot_no), 0) + 1 INTO v_slot
    FROM public.user_missions m
   WHERE m.user_journey_id = v_journey.id AND m.day_no = v_journey.current_day;

  INSERT INTO public.user_missions
    (user_journey_id, user_id, day_no, slot_no, content_key, mission_type,
     planned_duration_sec, difficulty, source_rule, status, assigned_by, prescription)
  VALUES
    (v_journey.id, p_client_user_id, v_journey.current_day, v_slot, p_content_key, 'combo',
     coalesce(v_content.release_duration_sec, 180), 1, 'professional', 'scheduled', v_pro,
     jsonb_build_object('note', v_note, 'assigned_at', now()))
  RETURNING id INTO v_mission;

  INSERT INTO public.professional_activity_log (professional_id, client_user_id, event)
  VALUES (v_pro, p_client_user_id, 'assignment_created');

  RETURN v_mission;
END $$;

COMMENT ON FUNCTION public.assign_client_mission(uuid, text, text) IS
  '전문가가 자기 고객에게 미션을 배정한다. 콘텐츠는 라이브러리에서만 고르고 메모는 200자. 하루 3개까지.';

-- ---------------------------------------------------------------------------
-- 3) 배정 취소 — 고객이 아직 시작하지 않은 것만
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_client_assignment(p_mission_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pro     uuid := public.current_professional_id();
  v_client  uuid;
BEGIN
  IF v_pro IS NULL THEN
    RAISE EXCEPTION '전문가 계정만 취소할 수 있습니다' USING ERRCODE = '42501';
  END IF;

  -- 이미 시작했거나 끝낸 미션은 지우지 않습니다. 고객이 한 일을 없앨 수는 없습니다.
  DELETE FROM public.user_missions m
   WHERE m.id = p_mission_id
     AND m.assigned_by = v_pro
     AND m.status = 'scheduled'
  RETURNING m.user_id INTO v_client;

  IF v_client IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.professional_activity_log (professional_id, client_user_id, event)
  VALUES (v_pro, v_client, 'assignment_cancelled');

  RETURN true;
END $$;

COMMENT ON FUNCTION public.cancel_client_assignment(uuid) IS
  '전문가가 자기 배정을 거둔다. 고객이 아직 시작하지 않은 것만 지워진다.';

-- ---------------------------------------------------------------------------
-- 4) 전문가가 고를 수 있는 콘텐츠 목록
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assignable_contents()
RETURNS TABLE (content_key text, display_name text, target_muscle text,
               release_title text, stretch_title text, caution text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.current_professional_id() IS NULL THEN
    RETURN;  -- 전문가가 아니면 0행.
  END IF;

  RETURN QUERY
  SELECT c.content_key, c.display_name, c.target_muscle,
         c.release_title, c.stretch_title, c.caution
    FROM public.immediate_action_content c
   ORDER BY c.sort_order;
END $$;

COMMENT ON FUNCTION public.assignable_contents() IS
  '전문가가 배정할 수 있는 콘텐츠. 라이브러리에 있는 것이 전부다.';

-- ---------------------------------------------------------------------------
-- 5) 권한 — CREATE FUNCTION 은 PUBLIC 에 EXECUTE 를 준다 (044·053·056 과 같은 이유)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.assign_client_mission(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_client_assignment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assignable_contents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_client_mission(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_client_assignment(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assignable_contents() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------------
SELECT has_function_privilege('authenticated', 'public.assign_client_mission(uuid,text,text)', 'EXECUTE') AS "회원_실행(true여야)",
       has_function_privilege('anon', 'public.assign_client_mission(uuid,text,text)', 'EXECUTE')          AS "익명_실행(false여야)";

SELECT column_name AS 컬럼 FROM information_schema.columns
 WHERE table_schema='public' AND table_name='user_missions' AND column_name IN ('assigned_by','prescription');

-- user_missions 정책은 그대로여야 합니다(고객 본인만 읽고 쓴다).
SELECT policyname AS 정책, cmd AS 동작 FROM pg_policies WHERE tablename='user_missions' ORDER BY cmd;
