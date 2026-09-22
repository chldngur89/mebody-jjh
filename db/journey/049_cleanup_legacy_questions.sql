-- ===========================================================================
-- MEBODY — questions 에 남아 있는 옛 문항 53행 정리
--
-- 상태 확인(실측):
--   questions          mebody_v1_32 32행(활성) + v3_full 53행(비활성)
--   questions_archive  v3_full 53행
--   → **같은 53행이 두 곳에 있습니다.** 043 이 옮겼는데 어느 시점에 되돌아왔습니다.
--
-- 앱은 is_active AND question_set='mebody_v1_32' 로만 읽으므로 화면에는 영향이 없습니다.
-- 다만 문항 테이블을 열어 보는 사람마다 "이 53행은 뭔가" 를 다시 묻게 됩니다.
--
-- 안전한가: 아카이브와 한 행씩 대조했습니다. 빠진 행 0건, 내용이 다른 행 0건입니다.
--           되돌리려면 아래 주석의 INSERT 한 줄이면 됩니다.
--
-- 함께: v1/015 의 테이블 역할 주석이 빠져 있어 같이 넣습니다.
--       "DO NOT DROP" 이 적힌 주석이라, 없으면 나중에 이 테이블을 지워도 되는 줄 압니다.
--
-- 선행: 043 적용 완료
-- ===========================================================================

-- 이 파일은 스스로 BEGIN/COMMIT 하지 않습니다.
-- 안쪽 DO 블록이 검사와 삭제를 함께 하므로 그 단위로 이미 원자적이고,
-- 밖에서 트랜잭션으로 감싸 시험해 보려는 쪽(검증 스크립트)을 방해하지 않습니다.

-- ---------------------------------------------------------------------------
-- 1) 아카이브에 그대로 있는 것만 지웁니다
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_unarchived integer;
  v_removed    integer;
  v_active     integer;
  v_total      integer;
BEGIN
  SELECT count(*) INTO v_unarchived
    FROM public.questions q
   WHERE q.question_set <> 'mebody_v1_32'
     AND NOT EXISTS (SELECT 1 FROM public.questions_archive a WHERE a.id = q.id);

  IF v_unarchived > 0 THEN
    RAISE EXCEPTION '아카이브에 없는 옛 문항이 %건 있습니다. 지우지 않고 멈춥니다.', v_unarchived;
  END IF;

  DELETE FROM public.questions q
   WHERE q.question_set <> 'mebody_v1_32';
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  SELECT count(*) INTO v_total  FROM public.questions;
  SELECT count(*) INTO v_active FROM public.questions WHERE is_active;

  IF v_active <> 32 OR v_total <> 32 THEN
    RAISE EXCEPTION '정리 후 32행이어야 하는데 전체 %행 / 활성 %행입니다. 되돌립니다.', v_total, v_active;
  END IF;

  RAISE NOTICE '옛 문항 %건을 지웠습니다. 남은 문항 %건(전부 활성).', v_removed, v_total;
END $$;

-- ---------------------------------------------------------------------------
-- 2) 테이블 역할 주석 (v1/015 와 같은 내용)
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.questions IS
  '문항 UI 원본(mebody_v1_32 32행). 앱 fetchQuestions() 가 읽습니다. 지우지 마십시오.';
COMMENT ON COLUMN public.questions.question_set IS 'mebody_v1_32 | sample_subjective_v1 | v3_full(보관됨)';
COMMENT ON TABLE public.question_choice_scores IS
  '선택지별 점수표(96행 = 32×3). questions 를 대체하지 않고 보완합니다.';
COMMENT ON TABLE public.questions_archive IS
  '옛 문항 보관소. 043 에서 옮겼고 049 에서 questions 쪽 중복을 지웠습니다. 앱은 읽지 않습니다.';


-- ---------------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------------
SELECT question_set AS 문항세트, count(*)::int AS 행수, bool_or(is_active) AS 활성
  FROM public.questions GROUP BY 1 ORDER BY 1;

SELECT count(*)::int AS "보관된 옛 문항" FROM public.questions_archive;

-- ---------------------------------------------------------------------------
-- 되돌리는 법
--
-- SELECT * 로는 안 됩니다. 아카이브에는 보관용 컬럼 두 개(archived_at, archived_reason)가
-- 더 있어서 열 수가 맞지 않습니다. 컬럼을 적어 주어야 합니다.
-- ---------------------------------------------------------------------------
-- INSERT INTO public.questions (
--   id, question_number, axis, question_text, option_1, option_2, option_3,
--   created_at, weight_a, weight_b, updated_at, question_code, sort_order,
--   question_version, is_precheck, is_scored, is_active, answer_type, max_select,
--   question_set, media_type, media_url, title, part, instruction, guide_text,
--   axis_anchor, axis_priority, media_url_option_1, media_url_option_2, media_url_option_3)
-- SELECT
--   id, question_number, axis, question_text, option_1, option_2, option_3,
--   created_at, weight_a, weight_b, updated_at, question_code, sort_order,
--   question_version, is_precheck, is_scored, is_active, answer_type, max_select,
--   question_set, media_type, media_url, title, part, instruction, guide_text,
--   axis_anchor, axis_priority, media_url_option_1, media_url_option_2, media_url_option_3
-- FROM public.questions_archive;
