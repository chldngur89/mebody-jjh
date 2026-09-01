-- MEBODY Journey — journey_content_tags 시드 (23행)
--
-- immediate_action_content 23행에 추천 규칙이 쓸 메타를 붙인다.
-- 본문(이완/스트레칭 텍스트, 주의사항)은 복사하지 않고 immediate_action_content 를 조회한다.
--
-- difficulty 산출 근거 (원본에 강도 정보가 없어 도구 부담을 대리 지표로 사용):
--   1 = 맨손만            (손)
--   2 = 맨손 대체 가능 또는 소도구 (손/폼롤러, 손/폼롤러/마사지볼, 마사지볼, 마사지볼/테니스볼)
--   3 = 폼롤러 필요        (폼롤러, 폼롤러/마사지볼)
--
-- base_duration_sec = 180 = 이완 90초 + 스트레칭 30초 x 3세트 (원본 23행 전부 동일 규격)
--
-- 재실행 안전: content_key 충돌 시 갱신.

INSERT INTO public.journey_content_tags
  (content_key, axis_key, direction_key, body_part_key, mission_type, difficulty, base_duration_sec, equipment, is_active)
VALUES
  ('neck_right', NULL, 'R', 'neck', 'combo', 1, 180, '{"손"}'::text[], true),
  ('neck_left', NULL, 'L', 'neck', 'combo', 1, 180, '{"손"}'::text[], true),
  ('shoulder_right', NULL, 'R', 'shoulder', 'combo', 3, 180, '{"폼롤러","마사지볼"}'::text[], true),
  ('shoulder_left', NULL, 'L', 'shoulder', 'combo', 3, 180, '{"폼롤러","마사지볼"}'::text[], true),
  ('back_both', NULL, 'both', 'back', 'combo', 3, 180, '{"폼롤러"}'::text[], true),
  ('waist_right', NULL, 'R', 'waist', 'combo', 2, 180, '{"마사지볼"}'::text[], true),
  ('waist_left', NULL, 'L', 'waist', 'combo', 2, 180, '{"마사지볼"}'::text[], true),
  ('pelvis_right', NULL, 'R', 'pelvis', 'combo', 3, 180, '{"폼롤러","마사지볼"}'::text[], true),
  ('pelvis_left', NULL, 'L', 'pelvis', 'combo', 3, 180, '{"폼롤러","마사지볼"}'::text[], true),
  ('knee_right', NULL, 'R', 'knee', 'combo', 2, 180, '{"손","폼롤러","마사지볼"}'::text[], true),
  ('knee_left', NULL, 'L', 'knee', 'combo', 2, 180, '{"손","폼롤러","마사지볼"}'::text[], true),
  ('ankle_right', NULL, 'R', 'ankle', 'combo', 2, 180, '{"손","폼롤러"}'::text[], true),
  ('ankle_left', NULL, 'L', 'ankle', 'combo', 2, 180, '{"손","폼롤러"}'::text[], true),
  ('foot_right', NULL, 'R', 'foot', 'combo', 2, 180, '{"마사지볼","테니스볼"}'::text[], true),
  ('foot_left', NULL, 'L', 'foot', 'combo', 2, 180, '{"마사지볼","테니스볼"}'::text[], true),
  ('axis_1F', 'neck', 'F', 'neck', 'combo', 1, 180, '{"손"}'::text[], true),
  ('axis_1C', 'neck', 'C', 'neck', 'combo', 1, 180, '{"손"}'::text[], true),
  ('axis_2R', 'shoulder', 'R', 'shoulder', 'combo', 3, 180, '{"폼롤러","마사지볼"}'::text[], true),
  ('axis_2L', 'shoulder', 'L', 'shoulder', 'combo', 3, 180, '{"폼롤러","마사지볼"}'::text[], true),
  ('axis_3R', 'pelvis', 'R', 'pelvis', 'combo', 3, 180, '{"폼롤러","마사지볼"}'::text[], true),
  ('axis_3L', 'pelvis', 'L', 'pelvis', 'combo', 3, 180, '{"폼롤러","마사지볼"}'::text[], true),
  ('axis_4S', 'lower', 'S', 'lower', 'combo', 3, 180, '{"폼롤러"}'::text[], true),
  ('axis_4F', 'lower', 'F', 'lower', 'combo', 1, 180, '{"손"}'::text[], true)
ON CONFLICT (content_key) DO UPDATE SET
  axis_key          = EXCLUDED.axis_key,
  direction_key     = EXCLUDED.direction_key,
  body_part_key     = EXCLUDED.body_part_key,
  mission_type      = EXCLUDED.mission_type,
  difficulty        = EXCLUDED.difficulty,
  base_duration_sec = EXCLUDED.base_duration_sec,
  equipment         = EXCLUDED.equipment,
  is_active         = EXCLUDED.is_active,
  updated_at        = now();


-- 검증
--   SELECT count(*) FROM public.journey_content_tags;                       -- 23
--   SELECT count(*) FROM public.journey_content_tags WHERE axis_key IS NOT NULL;  -- 8
--   SELECT t.content_key FROM public.journey_content_tags t
--     LEFT JOIN public.immediate_action_content c USING (content_key)
--    WHERE c.content_key IS NULL;                                           -- 0행이어야 함
