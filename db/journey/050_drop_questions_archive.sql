-- ===========================================================================
-- MEBODY — 32문항 말고는 남기지 않습니다
--
-- 지금 상태:
--   questions          mebody_v1_32 32행 (049 에서 옛 문항을 지움)
--   questions_archive  v3_full 53행      ← 이 파일이 지웁니다
--
-- 확인한 것:
--   · 홈페이지 12문항 샘플은 **DB 를 읽지 않습니다.**
--     sample-questionnaire 가 VITE_USE_SUPABASE_QUESTIONS 가 'true' 일 때만 DB 를 보는데
--     그 값이 설정돼 있지 않고, DB 에 sample_subjective_v1 행도 0개입니다.
--     문항은 번들 안 sampleQuestionsSnapshot.ts(12문항)에서 나옵니다. 영향 없습니다.
--   · question_choice_scores 는 mebody_v1_32 96행뿐이라 건드리지 않습니다.
--   · 옛 응답 344건(v2_40·v3_49_precheck)은 그대로 둡니다. 실제 사용자 기록입니다.
--     그 버전의 문항은 이미 오래전에 사라져 있어 이번 삭제와 무관합니다.
--
-- 되살리려면: db/journey/backup_questions_archive_v3_full.sql 을 실행하십시오.
--   지우기 직전에 53행을 전부 INSERT 문으로 떠두었습니다.
--
-- 선행: 049 적용 완료
-- ===========================================================================

DO $$
DECLARE
  v_total  integer;
  v_active integer;
  v_other  integer;
BEGIN
  -- 32문항이 멀쩡한지 먼저 봅니다. 여기가 어긋나면 아무것도 지우지 않습니다.
  SELECT count(*) INTO v_total  FROM public.questions;
  SELECT count(*) INTO v_active FROM public.questions WHERE is_active;
  SELECT count(*) INTO v_other  FROM public.questions WHERE question_set <> 'mebody_v1_32';

  IF v_total <> 32 OR v_active <> 32 OR v_other <> 0 THEN
    RAISE EXCEPTION 'questions 가 32행(전부 활성, mebody_v1_32)이어야 합니다. 현재 전체 % / 활성 % / 다른 세트 %. 멈춥니다.',
      v_total, v_active, v_other;
  END IF;
END $$;

DROP TABLE IF EXISTS public.questions_archive;

-- ---------------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------------
SELECT question_set AS 문항세트, count(*)::int AS 행수, bool_or(is_active) AS 활성
  FROM public.questions GROUP BY 1 ORDER BY 1;

SELECT to_regclass('public.questions_archive') IS NULL AS "아카이브 삭제됨(true여야)";
