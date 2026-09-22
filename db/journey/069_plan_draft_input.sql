-- ===========================================================================
-- MEBODY — 전문가에게 "앱이 오늘 무엇을 배정할까" 를 미리 보여주기 위한 입력 (Phase 4)
--
-- ※ db/journey 폴더의 069 입니다.
--
-- ── 왜 함수 하나인가
-- 규칙 엔진(selectDailyMissions)이 필요로 하는 것은 다섯 가지입니다:
-- 저니(축 우선순위·시작일), 템플릿의 day_plan, 콘텐츠 태그, 최근 피드백, 최근 쓴 콘텐츠.
-- 이걸 따로 부르면 그 사이에 고객이 동의를 거둬도 절반은 이미 넘어간 뒤입니다.
-- 한 번에 한 시점을 읽습니다(056 의 get_client_journey_summary 와 같은 이유).
--
-- ── 권한
-- 통과 조건은 053·056·059 와 **똑같습니다**: 활성 전문가 · ACTIVE 관계 · 고객 동의.
-- 어긋나면 NULL 입니다.
--
-- ── 무엇을 돌려주지 않는가
-- 콘텐츠 본문(동작 설명)은 넣지 않습니다. 초안을 고르는 데는 태그와 키만 있으면 되고,
-- 본문은 이미 assignable_contents() 로 따로 받습니다. 한 응답에 다 실으면
-- 필요 없는 자료가 매번 나갑니다.
--
-- 선행: 052 · 053 · 056 · 059 적용 완료
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.get_client_plan_input(p_client_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pro     uuid := public.current_professional_id();
  v_journey public.user_journeys%ROWTYPE;
  v_result  jsonb;
BEGIN
  IF v_pro IS NULL OR p_client_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.professional_clients pc
     WHERE pc.professional_id = v_pro
       AND pc.client_user_id  = p_client_user_id
       AND pc.status          = 'ACTIVE'
       AND pc.consented_at IS NOT NULL
  ) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_journey
    FROM public.user_journeys j
   WHERE j.user_id = p_client_user_id AND j.status = 'active'
   ORDER BY j.last_active_at DESC NULLS LAST, j.started_at DESC
   LIMIT 1;

  IF v_journey.id IS NULL THEN
    RETURN jsonb_build_object('has_journey', false);
  END IF;

  SELECT jsonb_build_object(
    'has_journey', true,
    -- 며칠차인가는 060 의 함수가 정합니다. 앱과 같은 계산이어야 초안도 같아집니다.
    'day_no', public.journey_current_day(v_journey.id),
    'last_active_at', v_journey.last_active_at,
    'axis_priority', v_journey.axis_priority,
    'day_plan', (SELECT t.day_plan FROM public.journey_templates t WHERE t.code = v_journey.template_code),
    'content_tags', coalesce((
      SELECT jsonb_agg(to_jsonb(ct)) FROM public.journey_content_tags ct
    ), '[]'::jsonb),
    -- 엔진은 최근 3건만 씁니다. 넉넉히 10건만 보냅니다.
    'feedback', coalesce((
      SELECT jsonb_agg(f ORDER BY (f->>'created_at') DESC) FROM (
        SELECT jsonb_build_object('feeling', fb.feeling, 'difficulty', fb.difficulty,
                                  'content_key', m.content_key, 'created_at', fb.created_at) AS f
          FROM public.journey_mission_feedback fb
          JOIN public.user_missions m ON m.id = fb.user_mission_id
         WHERE m.user_journey_id = v_journey.id
         ORDER BY fb.created_at DESC LIMIT 10
      ) t
    ), '[]'::jsonb),
    -- 반복을 피하는 데만 씁니다. 최신순.
    'recent_content_keys', coalesce((
      SELECT jsonb_agg(k) FROM (
        SELECT DISTINCT ON (m.content_key) m.content_key AS k, m.day_no
          FROM public.user_missions m
         WHERE m.user_journey_id = v_journey.id
           AND m.day_no < public.journey_current_day(v_journey.id)
         ORDER BY m.content_key, m.day_no DESC
      ) t
    ), '[]'::jsonb),
    -- 오늘 이미 배정된 것. 초안과 겹치는지 화면이 보여줘야 합니다.
    'today_missions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', m.id, 'content_key', m.content_key, 'slot_no', m.slot_no,
               'status', m.status, 'assigned_by', m.assigned_by))
        FROM public.user_missions m
       WHERE m.user_journey_id = v_journey.id
         AND m.day_no = public.journey_current_day(v_journey.id)
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END $$;

COMMENT ON FUNCTION public.get_client_plan_input(uuid) IS
  '전문가가 규칙 엔진 초안을 보기 위한 입력 한 덩어리. 관계가 ACTIVE 이고 동의가 있어야 한다. 콘텐츠 본문은 넣지 않는다.';

REVOKE ALL ON FUNCTION public.get_client_plan_input(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_client_plan_input(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------------
SELECT has_function_privilege('authenticated', 'public.get_client_plan_input(uuid)', 'EXECUTE') AS "회원_실행(true여야)",
       has_function_privilege('anon', 'public.get_client_plan_input(uuid)', 'EXECUTE')          AS "익명_실행(false여야)";
