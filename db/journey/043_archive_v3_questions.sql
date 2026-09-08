-- ===========================================================================
-- MEBODY — 쓰지 않는 v3 문항 세트를 questions 에서 걷어낸다
--
-- 확인한 현재 상태:
--   · questions 85행 = mebody_v1_32 (32행, is_active) + v3_full (53행, 비활성)
--   · **questions 를 참조하는 FK 가 하나도 없다**
--   · question_choice_scores 는 (question_set, question_code) 문자열로 연결되고
--     mebody_v1_32 96행뿐이다 — v3 채점표는 애초에 없다
--   · 앱은 question_set='mebody_v1_32' AND is_active 만 읽는다
--     (src/api/questionnaire.ts 의 loadQuestionsFromSource)
--   · 코드에서 v3 를 쓰는 곳은 없다(옛 localStorage 키 청소 문자열뿐)
--
-- 그런데 지우기 전에 알아야 할 것:
--   questionnaire_responses 에 **question_version='v3_49_precheck' 인 응답이 120건**
--   (완료 92건) 남아 있다. 문항 행을 없애면 그 응답들이 "무엇을 물었는지"를 잃는다.
--   화면은 v1 만 읽으므로 기능은 깨지지 않지만, 기록은 영구히 사라진다.
--
--   그래서 지우기 전에 **questions_archive 로 옮긴다.**
--   작업 테이블(questions)은 32행만 남아 깨끗해지고, 기록은 남는다.
--   정말로 완전히 없애고 싶으면 맨 아래 DROP 한 줄을 실행하면 된다.
--
-- 선행: 020~042 적용 완료
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) 보관 테이블 — questions 와 같은 모양
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.questions_archive (LIKE public.questions INCLUDING DEFAULTS);

ALTER TABLE public.questions_archive ADD COLUMN IF NOT EXISTS archived_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.questions_archive ADD COLUMN IF NOT EXISTS archived_reason text;

COMMENT ON TABLE public.questions_archive IS
  '더 이상 쓰지 않는 문항 세트 보관소. questionnaire_responses 에 남은 옛 응답이 무엇을 물었는지 되짚을 때 쓴다.';

-- 앱은 이 테이블을 볼 일이 없다.
-- ★ REVOKE ALL 을 먼저 한다 — Supabase 기본 GRANT ALL 에 TRUNCATE 가 딸려오고,
--   TRUNCATE 는 RLS 를 적용받지 않는다(041 에서 겪은 문제).
ALTER TABLE public.questions_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.questions_archive FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) 옮기기 — 활성 세트는 절대 건드리지 않는다
--
--    조건을 세 겹으로 건다(is_active=false / 세트명 / 활성 세트 제외).
--    실수로 32문항이 딸려가면 서비스가 멈추기 때문이다.
-- ---------------------------------------------------------------------------
INSERT INTO public.questions_archive
SELECT q.*, now(), 'v3 세트 미사용 — 043'
  FROM public.questions q
 WHERE q.is_active = false
   AND q.question_set = 'v3_full'
   AND q.question_set <> 'mebody_v1_32'
   AND NOT EXISTS (
     SELECT 1 FROM public.questions_archive a
      WHERE a.id = q.id
   );

DELETE FROM public.questions q
 WHERE q.is_active = false
   AND q.question_set = 'v3_full'
   AND q.question_set <> 'mebody_v1_32'
   AND EXISTS (SELECT 1 FROM public.questions_archive a WHERE a.id = q.id);

-- ---------------------------------------------------------------------------
-- 3) 안전장치 — 활성 32문항이 그대로인지 확인하고, 아니면 통째로 되돌린다
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_active integer;
  v_total  integer;
BEGIN
  SELECT count(*) INTO v_active FROM public.questions
   WHERE is_active AND question_set = 'mebody_v1_32';
  SELECT count(*) INTO v_total FROM public.questions;

  IF v_active <> 32 THEN
    RAISE EXCEPTION '활성 문항이 32개가 아닙니다(현재 %). 되돌립니다.', v_active;
  END IF;
  IF v_total <> 32 THEN
    RAISE EXCEPTION 'questions 에 32행만 남아야 하는데 %행입니다. 되돌립니다.', v_total;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) 확인
-- ---------------------------------------------------------------------------
SELECT question_set AS 세트, count(*)::int AS 문항수,
       count(*) FILTER (WHERE is_active)::int AS 활성
  FROM public.questions GROUP BY 1 ORDER BY 1;

SELECT count(*)::int AS 보관된_문항 FROM public.questions_archive;

-- 옛 응답은 그대로 남아 있다(문항만 옮겼을 뿐이다)
SELECT COALESCE(question_version, '(없음)') AS 버전, count(*)::int AS 응답수
  FROM public.questionnaire_responses GROUP BY 1 ORDER BY 2 DESC;

-- ---------------------------------------------------------------------------
-- 5) 정말로 완전히 지우고 싶다면 (지금은 실행하지 말 것)
--
--    이걸 실행하면 옛 응답 120건이 무엇을 물었는지 다시는 알 수 없다.
--
--    DROP TABLE public.questions_archive;
--
--    반대로 되돌리려면:
--    INSERT INTO public.questions
--    SELECT (a.*)::public.questions FROM public.questions_archive a;
-- ---------------------------------------------------------------------------
