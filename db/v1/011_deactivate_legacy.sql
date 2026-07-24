UPDATE public.questions
SET is_active = false, updated_at = now()
WHERE COALESCE(question_set, 'v3_full') <> 'sample_subjective_v1'
  AND COALESCE(question_set, 'v3_full') <> 'mebody_v1_32';

DELETE FROM public.questions WHERE question_set = 'mebody_v1_32';
DELETE FROM public.question_choice_scores WHERE question_set = 'mebody_v1_32';
