-- ===========================================================================
-- MEBODY — 마이 바디 노트 (사용자 하루 기록) + 전문가 안내
--
-- ※ db/journey 폴더의 074 입니다.
--    설계 문서는 072·073 번호로 적었지만 그 번호는 주사위 재설계와 하루 경계가
--    이미 썼습니다. 074 로 밀립니다(docs/MEBODY_BODY_NOTE_PLAN.md 12장).
--
-- WHY
--   미션 피드백은 "방금 한 동작이 어땠나" 를 묻습니다. 그런데 미션을 안 한 날의 몸은
--   아무 데도 남지 않습니다. 바디 노트는 **미션과 무관한 하루의 상태**를 받습니다.
--   둘을 섞으면 사용자는 같은 걸 두 번 적고, 두 숫자가 어긋나기 시작합니다.
--
--     미션 피드백  = ACTION RESPONSE  (방금 한 동작)
--     바디 노트    = DAILY STATE      (오늘 내 몸과 생활)
--
-- 의료 표현을 쓰지 않습니다
--   컬럼이 pain_score·symptom·diagnosis 가 아니라 discomfort_parts·condition 입니다.
--   값도 severe·acute 가 아니라 slightly_uncomfortable·very_uncomfortable 입니다.
--   이 앱은 진단하지 않습니다. 사용자가 **느낀 것**을 그대로 적어 둘 뿐입니다.
--
-- 통과 조건은 053 · 056 · 059 · 070 과 **똑같습니다.** 새로 쓰지 않고 복제합니다.
--
-- 적용: Supabase SQL Editor 에 이 파일 내용을 붙여넣고 실행합니다.
--       재실행해도 안전합니다.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0) current_profile_id() — auth.uid() → user_profiles.id
--
--    지금은 정책마다 이 서브쿼리를 직접 쓰고 있습니다. 조건이 여러 벌 흩어져 있으면
--    한 곳만 고치는 사고가 납니다. 여기서 헬퍼로 뽑고 새 정책은 이것만 봅니다.
--
--    `p.id = auth.uid()` 도 함께 보는 이유: 초기 가입자는 프로필 id 가 곧 auth id 인
--    경우가 있습니다(052 의 current_professional_id 가 같은 모양입니다).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id FROM public.user_profiles p
   WHERE p.auth_user_id = auth.uid() OR p.id = auth.uid()
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.current_profile_id() IS
  '지금 로그인한 사람의 user_profiles.id. RLS 정책이 공통으로 봅니다(074).';

REVOKE ALL ON FUNCTION public.current_profile_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_profile_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1) body_notes — 사용자 하루 기록
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.body_notes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  -- 한국시간 기준의 "사용자 날짜". 서버 UTC 날짜를 쓰면 밤 9시 이후 기록이 다음 날로
  -- 넘어갑니다. 앱이 KST 날짜를 만들어 보내고 아래 CHECK 가 다시 검증합니다.
  record_date      date NOT NULL,
  discomfort_parts text[] NOT NULL DEFAULT '{}',
  side             text,
  activity_tags    text[] NOT NULL DEFAULT '{}',
  condition        text NOT NULL,
  -- 자유 서술은 **핵심 기능이 아닙니다.** 선택만으로 20~30초에 끝나야 합니다.
  -- 덧붙이고 싶은 사람을 위한 자리일 뿐이라 길이를 짧게 묶습니다.
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- 하루 한 건. 같은 날 다시 저장하면 UPDATE 입니다(새 행이 아닙니다).
  CONSTRAINT body_notes_one_per_day UNIQUE (user_id, record_date),
  -- 허용값을 DB 가 지킵니다. 화면만 믿으면 API 를 직접 부르는 쪽으로 다른 값이 들어옵니다.
  CONSTRAINT body_notes_side_check CHECK (
    side IS NULL OR side IN ('left','right','both','similar','unsure')),
  CONSTRAINT body_notes_condition_check CHECK (
    condition IN ('comfortable','usual','slightly_uncomfortable','very_uncomfortable')),
  CONSTRAINT body_notes_parts_check CHECK (
    discomfort_parts <@ ARRAY['none','neck','shoulder','back','waist','pelvis',
                              'knee','ankle','other']::text[]),
  CONSTRAINT body_notes_activity_check CHECK (
    activity_tags <@ ARRAY['sitting_long','standing_long','walking','exercise',
                           'driving','screen','rest','other']::text[]),
  CONSTRAINT body_notes_note_len CHECK (note IS NULL OR char_length(note) <= 300),
  -- 미래 날짜를 막습니다. 기기 시계가 틀려도 내일 기록이 들어오면 안 됩니다.
  -- 하루를 여유로 둔 것은 시차·시계 오차 때문입니다(KST 자정 직후의 UTC 어제).
  CONSTRAINT body_notes_not_future CHECK (
    record_date <= ((now() AT TIME ZONE 'Asia/Seoul')::date + 1))
);

COMMENT ON TABLE public.body_notes IS
  '사용자가 직접 적는 하루 몸 상태. 진단이 아니라 본인이 느낀 것입니다(074).';
COMMENT ON COLUMN public.body_notes.record_date IS
  '한국시간 기준 사용자 날짜. 하루 한 건.';
COMMENT ON COLUMN public.body_notes.discomfort_parts IS
  '불편했던 부위. none 은 "없음" 이고 다른 값과 함께 올 수 없습니다(트리거가 정리).';

-- 타임라인은 늘 "내 기록을 최근 순으로" 입니다.
CREATE INDEX IF NOT EXISTS body_notes_user_date_idx
  ON public.body_notes (user_id, record_date DESC);

-- ---------------------------------------------------------------------------
-- 2) 입력 정리 트리거
--
--    '없음' 과 다른 부위를 같이 고르는 것을 CHECK 로 막지 않습니다. DB 제약으로 쓰면
--    복잡해지고, 실수로 둘을 고른 사용자를 오류로 막는 것은 과합니다. 조용히 정리합니다.
--    트리거로 두는 이유: 앱을 거치지 않고 들어와도 같은 규칙이 걸립니다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.body_notes_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF 'none' = ANY (NEW.discomfort_parts) THEN
    NEW.discomfort_parts := ARRAY['none']::text[];
    -- 불편한 곳이 없으면 좌우도 물을 것이 없습니다.
    NEW.side := NULL;
  END IF;
  -- 빈 문자열은 NULL 로. 화면이 빈 칸을 보내도 '' 가 남지 않게 합니다.
  IF NEW.note IS NOT NULL AND btrim(NEW.note) = '' THEN NEW.note := NULL; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS body_notes_normalize_trg ON public.body_notes;
CREATE TRIGGER body_notes_normalize_trg
  BEFORE INSERT OR UPDATE ON public.body_notes
  FOR EACH ROW EXECUTE FUNCTION public.body_notes_normalize();

-- ---------------------------------------------------------------------------
-- 3) professional_body_note_guidance — 전문가 안내
--
--    전문가가 고객의 기록을 보고 남기는 한마디입니다. 사용자 기록을 **고치는 것이
--    아니라** 따로 쌓입니다. 원본은 사용자 것입니다.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.professional_body_note_guidance (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id    uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  client_user_id     uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  -- 어떤 기록을 보고 쓴 것인지. 기록이 지워져도 안내는 남습니다(SET NULL).
  body_note_id       uuid REFERENCES public.body_notes(id) ON DELETE SET NULL,
  guidance_type      text NOT NULL,
  message            text NOT NULL,
  -- 권장 행동은 승인 콘텐츠에서만 고릅니다. 자유 입력이 아닙니다.
  linked_content_key text REFERENCES public.immediate_action_content(content_key),
  linked_mission_id  uuid REFERENCES public.user_missions(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  -- 철회는 줄을 지우지 않고 시각을 찍습니다. 사용자가 이미 읽었을 수 있습니다.
  withdrawn_at       timestamptz,
  -- 사용자가 읽었는지. 앱 내부 배지에 씁니다.
  read_at            timestamptz,
  CONSTRAINT pbng_type_check CHECK (guidance_type IN (
    'comment', 'check_next_session', 'lifestyle_suggestion', 'linked_mission')),
  CONSTRAINT pbng_message_len CHECK (char_length(message) BETWEEN 1 AND 500)
);

COMMENT ON TABLE public.professional_body_note_guidance IS
  '전문가가 고객의 바디 노트를 보고 남기는 안내. 사용자 기록을 고치지 않습니다(074).';

CREATE INDEX IF NOT EXISTS pbng_client_idx
  ON public.professional_body_note_guidance (client_user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4) 권한 — Supabase 기본값을 먼저 걷어냅니다
--
--    Supabase 는 public 스키마의 새 테이블에 GRANT ALL 을 주고 거기에 TRUNCATE 가
--    들어 있습니다. **TRUNCATE 는 RLS 를 우회합니다.**
--    041 · 048 · 052 · 054 · 056 · 071 에서 같은 이유로 물렸습니다.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.body_notes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.professional_body_note_guidance FROM PUBLIC, anon, authenticated;

-- 사용자 기록은 본인이 직접 다룹니다(RLS 로 제한).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_notes TO authenticated;
-- 전문가 안내는 사용자에게 읽기만. 쓰기는 아래 DEFINER 함수가 합니다.
GRANT SELECT ON public.professional_body_note_guidance TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) RLS — 사용자
--
--    FOR ALL 로 묶지 않습니다. 묶으면 INSERT 의 WITH CHECK 를 빼먹기 쉽습니다.
-- ---------------------------------------------------------------------------
ALTER TABLE public.body_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS body_notes_select ON public.body_notes;
CREATE POLICY body_notes_select ON public.body_notes FOR SELECT TO authenticated
  USING (user_id = public.current_profile_id());

DROP POLICY IF EXISTS body_notes_insert ON public.body_notes;
CREATE POLICY body_notes_insert ON public.body_notes FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());

DROP POLICY IF EXISTS body_notes_update ON public.body_notes;
CREATE POLICY body_notes_update ON public.body_notes FOR UPDATE TO authenticated
  USING (user_id = public.current_profile_id())
  WITH CHECK (user_id = public.current_profile_id());

DROP POLICY IF EXISTS body_notes_delete ON public.body_notes;
CREATE POLICY body_notes_delete ON public.body_notes FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id());

ALTER TABLE public.professional_body_note_guidance ENABLE ROW LEVEL SECURITY;

-- 사용자가 자기에게 온 안내를 읽는 것은 RLS 로 합니다.
--
-- 왜 서버 API 가 아닌가: 조건이 "client_user_id = 나" 한 줄입니다. 서버를 거치면
-- VITE_API_BASE_URL 이 틀렸을 때 화면이 통째로 빕니다(2026-09-22 감사 P0-1 이
-- 정확히 그 사고였습니다). **남의 데이터를 읽는 쪽만** 서버·DEFINER 로 갑니다.
DROP POLICY IF EXISTS pbng_read_own ON public.professional_body_note_guidance;
CREATE POLICY pbng_read_own ON public.professional_body_note_guidance
  FOR SELECT TO authenticated
  USING (client_user_id = public.current_profile_id() AND withdrawn_at IS NULL);

-- ---------------------------------------------------------------------------
-- 6) 사용자가 안내를 읽음 처리
--
--    읽음 시각은 사용자가 찍지만 **자기 것만** 찍을 수 있어야 합니다. UPDATE 권한을
--    주면 message 까지 고칠 수 있으므로 함수로만 엽니다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_guidance_read(p_guidance_id uuid)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_me uuid := public.current_profile_id();
BEGIN
  IF v_me IS NULL OR p_guidance_id IS NULL THEN RETURN false; END IF;
  UPDATE public.professional_body_note_guidance
     SET read_at = COALESCE(read_at, now())
   WHERE id = p_guidance_id AND client_user_id = v_me AND withdrawn_at IS NULL;
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.mark_guidance_read(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_guidance_read(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_guidance_read(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7) 전문가 — SECURITY DEFINER 함수로만
--
--    전문가에게 body_notes 테이블 SELECT 를 **주지 않습니다.** RLS 를 넓히는 대신
--    053 · 056 · 059 · 070 과 같은 모양의 함수를 만듭니다.
--    가드는 매 호출마다 관계를 다시 봅니다 — 캐시하면 철회가 즉시 듣지 않습니다.
--    관계가 없으면 오류가 아니라 **빈 결과**입니다(존재 여부를 흘리지 않습니다).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.professional_can_read_client(p_client_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.professional_clients pc
     WHERE pc.professional_id = public.current_professional_id()
       AND pc.client_user_id  = p_client_user_id
       AND pc.status          = 'ACTIVE'
       AND pc.consented_at   IS NOT NULL
  );
$$;

COMMENT ON FUNCTION public.professional_can_read_client(uuid) IS
  '전문가가 그 고객을 볼 수 있는가. 053·056·059·070 과 같은 조건을 한 곳에 둡니다(074).';

REVOKE ALL ON FUNCTION public.professional_can_read_client(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.professional_can_read_client(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.professional_can_read_client(uuid) TO authenticated, service_role;

-- 7.1 고객 기록 목록
CREATE OR REPLACE FUNCTION public.get_client_body_notes(p_client_user_id uuid, p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_days integer := greatest(1, least(COALESCE(p_days, 30), 180));
        v_rows jsonb;
BEGIN
  IF p_client_user_id IS NULL THEN RETURN NULL; END IF;
  IF NOT public.professional_can_read_client(p_client_user_id) THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'record_date' DESC), '[]'::jsonb) INTO v_rows
    FROM (
      SELECT jsonb_build_object(
               'id', bn.id,
               'record_date', bn.record_date,
               'discomfort_parts', to_jsonb(bn.discomfort_parts),
               'side', bn.side,
               'activity_tags', to_jsonb(bn.activity_tags),
               'condition', bn.condition,
               'note', bn.note,
               'updated_at', bn.updated_at) AS x
        FROM public.body_notes bn
       WHERE bn.user_id = p_client_user_id
         AND bn.record_date > ((now() AT TIME ZONE 'Asia/Seoul')::date - v_days)
    ) s;
  RETURN jsonb_build_object('days', v_days, 'notes', v_rows);
END $$;

-- 7.2 빈도 요약 — 전문가가 한눈에 보는 값
CREATE OR REPLACE FUNCTION public.get_client_body_note_summary(p_client_user_id uuid, p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_days integer := greatest(1, least(COALESCE(p_days, 30), 180));
        v_total integer;
        v_parts jsonb;
        v_cond jsonb;
BEGIN
  IF p_client_user_id IS NULL THEN RETURN NULL; END IF;
  IF NOT public.professional_can_read_client(p_client_user_id) THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_total FROM public.body_notes bn
   WHERE bn.user_id = p_client_user_id
     AND bn.record_date > ((now() AT TIME ZONE 'Asia/Seoul')::date - v_days);

  SELECT COALESCE(jsonb_object_agg(part, n), '{}'::jsonb) INTO v_parts FROM (
    SELECT part, count(*)::int AS n
      FROM public.body_notes bn, unnest(bn.discomfort_parts) AS part
     WHERE bn.user_id = p_client_user_id
       AND bn.record_date > ((now() AT TIME ZONE 'Asia/Seoul')::date - v_days)
       AND part <> 'none'
     GROUP BY part) p;

  SELECT COALESCE(jsonb_object_agg(condition, n), '{}'::jsonb) INTO v_cond FROM (
    SELECT condition, count(*)::int AS n
      FROM public.body_notes bn
     WHERE bn.user_id = p_client_user_id
       AND bn.record_date > ((now() AT TIME ZONE 'Asia/Seoul')::date - v_days)
     GROUP BY condition) c;

  RETURN jsonb_build_object('days', v_days, 'total', v_total,
                            'parts', v_parts, 'conditions', v_cond);
END $$;

-- 7.3 안내 작성 — 같은 가드를 통과해야 합니다(관계가 끊기면 쓰지도 못합니다)
CREATE OR REPLACE FUNCTION public.create_body_note_guidance(
  p_client_user_id uuid,
  p_body_note_id   uuid,
  p_guidance_type  text,
  p_message        text,
  p_content_key    text DEFAULT NULL,
  p_mission_id     uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pro uuid := public.current_professional_id();
        v_id uuid;
BEGIN
  IF v_pro IS NULL OR p_client_user_id IS NULL THEN RETURN NULL; END IF;
  IF NOT public.professional_can_read_client(p_client_user_id) THEN RETURN NULL; END IF;

  -- 남의 고객 기록 id 를 끼워 넣지 못하게 합니다.
  IF p_body_note_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.body_notes WHERE id = p_body_note_id AND user_id = p_client_user_id
  ) THEN RETURN NULL; END IF;

  INSERT INTO public.professional_body_note_guidance
    (professional_id, client_user_id, body_note_id, guidance_type, message,
     linked_content_key, linked_mission_id)
  VALUES (v_pro, p_client_user_id, p_body_note_id, p_guidance_type, p_message,
          p_content_key, p_mission_id)
  RETURNING id INTO v_id;

  INSERT INTO public.professional_activity_log (professional_id, client_user_id, event)
  VALUES (v_pro, p_client_user_id, 'body_note_guidance_created');

  RETURN v_id;
END $$;

-- 7.4 본문 수정 — 자기가 쓴 것만
CREATE OR REPLACE FUNCTION public.update_body_note_guidance(p_guidance_id uuid, p_message text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pro uuid := public.current_professional_id();
BEGIN
  IF v_pro IS NULL OR p_guidance_id IS NULL THEN RETURN false; END IF;
  UPDATE public.professional_body_note_guidance
     SET message = p_message, updated_at = now()
   WHERE id = p_guidance_id AND professional_id = v_pro AND withdrawn_at IS NULL;
  RETURN FOUND;
END $$;

-- 7.5 철회 — 지우지 않고 시각을 찍습니다
CREATE OR REPLACE FUNCTION public.withdraw_body_note_guidance(p_guidance_id uuid)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pro uuid := public.current_professional_id();
BEGIN
  IF v_pro IS NULL OR p_guidance_id IS NULL THEN RETURN false; END IF;
  UPDATE public.professional_body_note_guidance
     SET withdrawn_at = now(), updated_at = now()
   WHERE id = p_guidance_id AND professional_id = v_pro AND withdrawn_at IS NULL;
  RETURN FOUND;
END $$;

-- 전문가 함수 권한 — CREATE FUNCTION 은 EXECUTE 를 PUBLIC 에 줍니다.
-- Supabase 기본 권한은 anon 에게도 따로 줍니다. **둘 다 회수해야 합니다.**
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.get_client_body_notes(uuid, integer)',
    'public.get_client_body_note_summary(uuid, integer)',
    'public.create_body_note_guidance(uuid, uuid, text, text, text, uuid)',
    'public.update_body_note_guidance(uuid, text)',
    'public.withdraw_body_note_guidance(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 8) 전문가 활동 로그에 새 이벤트를 더합니다
--    070 이 attention_viewed 를 더한 것과 같은 방식입니다.
-- ---------------------------------------------------------------------------
ALTER TABLE public.professional_activity_log
  DROP CONSTRAINT IF EXISTS professional_activity_log_event_check;
ALTER TABLE public.professional_activity_log
  ADD CONSTRAINT professional_activity_log_event_check
  CHECK (event IN ('client_opened', 'activity_viewed', 'assignment_created',
                   'assignment_cancelled', 'invite_sent', 'attention_viewed',
                   'body_note_viewed', 'body_note_guidance_created'));

-- ---------------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_n int; v_bad text;
BEGIN
  -- 테이블과 RLS
  IF to_regclass('public.body_notes') IS NULL THEN
    RAISE EXCEPTION '074 실패: body_notes 가 없습니다';
  END IF;
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'body_notes';
  IF v_n <> 4 THEN
    RAISE EXCEPTION '074 실패: body_notes 정책이 4개가 아니라 %개입니다', v_n;
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.body_notes'::regclass) THEN
    RAISE EXCEPTION '074 실패: body_notes 에 RLS 가 꺼져 있습니다';
  END IF;

  -- anon 에게 아무 권한도 남으면 안 됩니다
  SELECT string_agg(DISTINCT table_name || ':' || privilege_type, ', ') INTO v_bad
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND grantee = 'anon'
     AND table_name IN ('body_notes', 'professional_body_note_guidance');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '074 실패: anon 에게 권한이 남아 있습니다 — %', v_bad;
  END IF;

  -- 전문가에게 테이블 직접 권한을 주지 않았는지(함수로만 읽어야 합니다)
  SELECT string_agg(privilege_type, ', ') INTO v_bad
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'body_notes'
     AND grantee = 'authenticated' AND privilege_type = 'TRUNCATE';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '074 실패: body_notes 에 TRUNCATE 가 남아 있습니다(RLS 를 우회합니다)';
  END IF;

  -- 함수가 다 있는지
  FOR v_bad IN
    SELECT f FROM unnest(ARRAY['current_profile_id','body_notes_normalize',
                               'professional_can_read_client','get_client_body_notes',
                               'get_client_body_note_summary','create_body_note_guidance',
                               'update_body_note_guidance','withdraw_body_note_guidance',
                               'mark_guidance_read']) AS f
     WHERE NOT EXISTS (
       SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
        WHERE ns.nspname = 'public' AND p.proname = f)
  LOOP
    RAISE EXCEPTION '074 실패: %() 가 없습니다', v_bad;
  END LOOP;

  -- 의료 표현이 컬럼 이름에 들어가지 않았는지
  SELECT string_agg(column_name, ', ') INTO v_bad
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'body_notes'
     AND column_name ~ '(pain|symptom|diagnos|disease|injur)';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '074 실패: 의료 표현 컬럼이 있습니다 — %', v_bad;
  END IF;

  RAISE NOTICE '074 완료 — 바디 노트 · 전문가 안내 · RLS · 전문가 함수 5개';
END $$;
