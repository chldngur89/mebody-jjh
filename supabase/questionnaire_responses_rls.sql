-- mebody questionnaire_responses anon 접근 정책
-- 실행 위치: Supabase SQL Editor

ALTER TABLE questionnaire_responses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'questionnaire_responses' AND policyname = 'questionnaire_responses read'
  ) THEN
    CREATE POLICY "questionnaire_responses read"
      ON questionnaire_responses FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'questionnaire_responses' AND policyname = 'questionnaire_responses insert'
  ) THEN
    CREATE POLICY "questionnaire_responses insert"
      ON questionnaire_responses FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'questionnaire_responses' AND policyname = 'questionnaire_responses update'
  ) THEN
    CREATE POLICY "questionnaire_responses update"
      ON questionnaire_responses FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;
