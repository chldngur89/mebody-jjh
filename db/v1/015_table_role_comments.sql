-- Idempotent: clarify questions vs question_choice_scores roles (no schema/drop).
-- Safe to re-run on existing promptDashboard DB.

COMMENT ON TABLE public.questions IS
  'Questionnaire UI source (32 rows for mebody_v1_32): question_text, options, instruction, guide_text, media. DO NOT DROP — app fetchQuestions() reads this table.';

COMMENT ON COLUMN public.questions.question_set IS 'mebody_v1_32 | sample_subjective_v1 | v3_full';

COMMENT ON TABLE public.question_choice_scores IS
  'Per-choice scoring map (96 rows = 32×3): axis/identity scores. Complements questions; does not replace it. App runtime currently uses bundled v1ScoreMapping.ts (same source).';
