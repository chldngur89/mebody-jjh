-- MEBODY — body_code_content identity / share / care strategy 확장
-- Idempotent: ADD COLUMN IF NOT EXISTS + UPDATE by body_code
--
-- 역할
--   body_code_content: 캐릭터·첫 화면·공유·케어 전략 (코드당 1행)
--   body_code_result_sections: 코드 플랜 상세 가이드 전용 (Home/공유 미사용)
--
-- Home/공유는 identity_* / share_* 를 쓰고, sections key 2/3 는 읽지 않습니다.

BEGIN;

ALTER TABLE public.body_code_content
  ADD COLUMN IF NOT EXISTS identity_title text,
  ADD COLUMN IF NOT EXISTS identity_summary text,
  ADD COLUMN IF NOT EXISTS identity_keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS share_title text,
  ADD COLUMN IF NOT EXISTS share_description text,
  ADD COLUMN IF NOT EXISTS strategy_key text,
  ADD COLUMN IF NOT EXISTS strategy_title text,
  ADD COLUMN IF NOT EXISTS strategy_summary text,
  ADD COLUMN IF NOT EXISTS primary_axis text,
  ADD COLUMN IF NOT EXISTS secondary_axis text,
  ADD COLUMN IF NOT EXISTS primary_goal text,
  ADD COLUMN IF NOT EXISTS secondary_goal text,
  ADD COLUMN IF NOT EXISTS starter_focus jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS progression_focus jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS journey_slug text,
  ADD COLUMN IF NOT EXISTS journey_title text,
  ADD COLUMN IF NOT EXISTS recommended_start_minutes int NOT NULL DEFAULT 5;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'body_code_content_recommended_start_minutes_check'
  ) THEN
    ALTER TABLE public.body_code_content
      ADD CONSTRAINT body_code_content_recommended_start_minutes_check
      CHECK (recommended_start_minutes BETWEEN 3 AND 15);
  END IF;
END $$;

COMMENT ON TABLE public.body_code_content IS
  'Body-code catalog (16 rows): character + identity/share copy + care strategy. Home/공유 단일 출처. exercises/lifestyle_tips는 legacy.';

COMMENT ON COLUMN public.body_code_content.identity_title IS '결과 첫 화면 부제(유형명)';
COMMENT ON COLUMN public.body_code_content.identity_summary IS '결과 첫 화면 본문 요약 — Home 단일 출처';
COMMENT ON COLUMN public.body_code_content.share_title IS 'SNS/Kakao 공유 제목';
COMMENT ON COLUMN public.body_code_content.share_description IS 'SNS/Kakao 공유 설명';
COMMENT ON COLUMN public.body_code_content.strategy_title IS '진단 후 관리 방향 제목';
COMMENT ON COLUMN public.body_code_content.strategy_summary IS '관리 방향 요약 (운동/상품 JSON 아님)';

COMMENT ON TABLE public.body_code_result_sections IS
  '코드 플랜 상세 가이드(section_key 0~5). Home/공유에서는 사용하지 않음 — identity는 body_code_content.';

UPDATE public.body_code_content SET
  character_name = '꽈악 잠금 로봇',
  identity_title = '단단하게 버티는 고정형',
  identity_summary = '몸을 느슨하게 두기보다 단단하게 잡고 버티는 움직임이 익숙한 타입입니다.',
  identity_keywords = '["단단함","버티기","회전","이완 필요"]'::jsonb,
  share_title = '내 몸BTI는 FRRS · 꽈악 잠금 로봇',
  share_description = '나는 몸을 단단하게 잡고 버티는 타입! 내 MEBODY 코드는 FRRS였어요.',
  strategy_key = 'release_then_control',
  strategy_title = '풀고 다시 잡기',
  strategy_summary = '처음에는 편안한 움직임 범위를 만들어보고 이후에는 그 범위에서 안정적으로 움직이는 경험을 늘리는 방향입니다.',
  primary_axis = 'flexibility',
  secondary_axis = 'pelvis',
  primary_goal = '하체 움직임의 여유 만들기',
  secondary_goal = '회전 움직임을 부드럽게 사용하기',
  starter_focus = '["gentle_mobility","breathing","lower_body_mobility"]'::jsonb,
  progression_focus = '["rotation_control","balance","whole_body_control"]'::jsonb,
  journey_slug = 'body-reset-release-control',
  journey_title = '굳은 몸 깨우기',
  recommended_start_minutes = 5,
  updated_at = now()
WHERE body_code = 'FRRS';

UPDATE public.body_code_content SET
  character_name = '기대면 흐르는 젤리인간',
  identity_title = '유연하게 기대는 흐름형',
  identity_summary = '움직임은 부드럽지만 스스로 중심을 유지하기보다 기대거나 한쪽으로 흐르는 움직임이 익숙한 타입입니다.',
  identity_keywords = '["유연함","기대기","흐름","중심 유지"]'::jsonb,
  share_title = '내 몸BTI는 FRRF · 기대면 흐르는 젤리인간',
  share_description = '나는 유연하지만 한쪽으로 기대기 쉬운 타입! 내 MEBODY 코드는 FRRF였어요.',
  strategy_key = 'control_before_more_mobility',
  strategy_title = '더 늘리기보다 중심 잡기',
  strategy_summary = '이미 움직임의 여유가 있는 편이므로 추가적인 유연성보다 편안한 범위 안에서 중심을 유지하는 경험을 우선합니다.',
  primary_axis = 'pelvis',
  secondary_axis = 'flexibility',
  primary_goal = '몸통과 골반의 안정적인 지지',
  secondary_goal = '유연한 범위 안에서 제어하기',
  starter_focus = '["basic_stability","foot_support","pelvic_control"]'::jsonb,
  progression_focus = '["single_leg_control","core_control","movement_quality"]'::jsonb,
  journey_slug = 'body-reset-soft-control',
  journey_title = '흐르는 몸 중심 잡기',
  recommended_start_minutes = 5,
  updated_at = now()
WHERE body_code = 'FRRF';

UPDATE public.body_code_content SET
  character_name = '꽈배기 금속 스프링',
  identity_title = '엇갈려 단단한 회전형',
  identity_summary = '상체와 하체가 서로 다른 방향으로 움직이면서도 전체적으로 단단하게 버티는 움직임이 나타나기 쉬운 타입입니다.',
  identity_keywords = '["엇갈림","단단함","회전","풀어주기"]'::jsonb,
  share_title = '내 몸BTI는 FRLS · 꽈배기 금속 스프링',
  share_description = '나는 몸이 엇갈려 돌아가면서 단단하게 버티는 타입! 내 MEBODY 코드는 FRLS였어요.',
  strategy_key = 'untwist_then_move',
  strategy_title = '엇갈림 풀고 회전 찾기',
  strategy_summary = '상체와 하체를 한꺼번에 바꾸기보다 편안한 회전 범위를 만들고 좌우 움직임을 다시 연결하는 방향입니다.',
  primary_axis = 'pelvis',
  secondary_axis = 'flexibility',
  primary_goal = '편안한 몸통 회전 경험',
  secondary_goal = '하체의 움직임 여유 만들기',
  starter_focus = '["rotation_mobility","breathing","hip_mobility"]'::jsonb,
  progression_focus = '["cross_body_control","gait_pattern","rotation_control"]'::jsonb,
  journey_slug = 'body-reset-untwist',
  journey_title = '꼬인 움직임 풀기',
  recommended_start_minutes = 5,
  updated_at = now()
WHERE body_code = 'FRLS';

UPDATE public.body_code_content SET
  character_name = '회전 많은 풍선인형',
  identity_title = '부드럽게 흔들리는 회전형',
  identity_summary = '움직임의 범위는 비교적 자유롭지만 중심을 일정하게 유지하는 것이 어려울 수 있는 타입입니다.',
  identity_keywords = '["유연함","회전","흔들림","안정"]'::jsonb,
  share_title = '내 몸BTI는 FRLF · 회전 많은 풍선인형',
  share_description = '나는 잘 움직이지만 중심이 흔들리기 쉬운 타입! 내 MEBODY 코드는 FRLF였어요.',
  strategy_key = 'stability_in_motion',
  strategy_title = '움직이면서 중심 잡기',
  strategy_summary = '움직임 자체를 줄이기보다 이미 가지고 있는 가동범위 안에서 흔들림을 조절하는 경험을 늘리는 방향입니다.',
  primary_axis = 'pelvis',
  secondary_axis = 'flexibility',
  primary_goal = '회전 중 중심 유지',
  secondary_goal = '하체 지지감 만들기',
  starter_focus = '["basic_stability","pelvic_control","foot_control"]'::jsonb,
  progression_focus = '["dynamic_balance","single_leg_control","rotation_control"]'::jsonb,
  journey_slug = 'body-reset-moving-balance',
  journey_title = '흔들림 속 중심 찾기',
  recommended_start_minutes = 5,
  updated_at = now()
WHERE body_code = 'FRLF';

UPDATE public.body_code_content SET
  character_name = '으쓱 고정 목각병정',
  identity_title = '상체를 단단히 잡는 고정형',
  identity_summary = '상체를 단단하게 잡아 자세를 유지하고 몸통 움직임은 작게 사용하는 경향이 나타나기 쉬운 타입입니다.',
  identity_keywords = '["고정","상체 긴장","단단함","회전"]'::jsonb,
  share_title = '내 몸BTI는 FLRS · 으쓱 고정 목각병정',
  share_description = '나는 상체를 단단하게 고정해서 버티는 타입! 내 MEBODY 코드는 FLRS였어요.',
  strategy_key = 'release_upper_then_rotate',
  strategy_title = '상체 힘 빼고 움직임 연결하기',
  strategy_summary = '상체를 과하게 고정하기보다 목과 어깨 주변의 부담을 줄이고 몸통 움직임을 함께 사용하는 방향입니다.',
  primary_axis = 'shoulder',
  secondary_axis = 'flexibility',
  primary_goal = '어깨 주변 움직임의 여유 만들기',
  secondary_goal = '몸통 회전 연결하기',
  starter_focus = '["upper_body_mobility","breathing","thoracic_mobility"]'::jsonb,
  progression_focus = '["scapular_control","rotation_control","whole_body_control"]'::jsonb,
  journey_slug = 'body-reset-upper-release',
  journey_title = '굳은 상체 부드럽게 만들기',
  recommended_start_minutes = 5,
  updated_at = now()
WHERE body_code = 'FLRS';

UPDATE public.body_code_content SET
  character_name = '리듬 타는 갈대',
  identity_title = '유연하게 흔들리는 균형형',
  identity_summary = '몸은 비교적 부드럽게 움직이지만 한 자세를 오래 유지하기보다 움직이며 균형을 찾는 경향이 있는 타입입니다.',
  identity_keywords = '["유연함","흔들림","리듬","지지"]'::jsonb,
  share_title = '내 몸BTI는 FLRF · 리듬 타는 갈대',
  share_description = '나는 부드럽게 움직이며 균형을 찾는 타입! 내 MEBODY 코드는 FLRF였어요.',
  strategy_key = 'support_flexible_body',
  strategy_title = '유연함에 지지 더하기',
  strategy_summary = '몸의 유연함은 유지하면서 한 자세와 움직임을 안정적으로 지지하는 경험을 늘리는 방향입니다.',
  primary_axis = 'shoulder',
  secondary_axis = 'pelvis',
  primary_goal = '상체 지지감 만들기',
  secondary_goal = '몸통과 골반 연결하기',
  starter_focus = '["basic_stability","scapular_control","core_control"]'::jsonb,
  progression_focus = '["dynamic_balance","carrying_control","whole_body_control"]'::jsonb,
  journey_slug = 'body-reset-flex-support',
  journey_title = '흔들리는 몸 지지 만들기',
  recommended_start_minutes = 5,
  updated_at = now()
WHERE body_code = 'FLRF';

UPDATE public.body_code_content SET
  character_name = '한쪽에 박힌 말뚝',
  identity_title = '한쪽으로 단단한 고정형',
  identity_summary = '한쪽을 기준으로 몸을 단단히 지지하며 움직이는 습관이 나타나기 쉬운 타입입니다.',
  identity_keywords = '["한쪽 지지","고정","단단함","균형"]'::jsonb,
  share_title = '내 몸BTI는 FLLS · 한쪽에 박힌 말뚝',
  share_description = '나는 한쪽을 중심으로 단단하게 버티는 타입! 내 MEBODY 코드는 FLLS였어요.',
  strategy_key = 'shift_and_release',
  strategy_title = '한쪽 고정 풀고 체중 이동하기',
  strategy_summary = '한쪽에 머무르는 습관을 억지로 반대로 만들기보다 좌우로 편안하게 체중을 옮기는 경험을 늘립니다.',
  primary_axis = 'pelvis',
  secondary_axis = 'flexibility',
  primary_goal = '좌우 체중 이동 경험',
  secondary_goal = '하체 움직임 여유 만들기',
  starter_focus = '["weight_shift","hip_mobility","breathing"]'::jsonb,
  progression_focus = '["gait_pattern","single_leg_control","balance"]'::jsonb,
  journey_slug = 'body-reset-weight-shift',
  journey_title = '한쪽 고정에서 벗어나기',
  recommended_start_minutes = 5,
  updated_at = now()
WHERE body_code = 'FLLS';

UPDATE public.body_code_content SET
  character_name = '녹아내리는 소프트콘',
  identity_title = '부드럽게 기대는 비대칭형',
  identity_summary = '몸을 단단하게 고정하기보다 부드럽게 기대거나 한쪽으로 체중을 옮기는 움직임이 익숙한 타입입니다.',
  identity_keywords = '["유연함","기대기","비대칭","중심"]'::jsonb,
  share_title = '내 몸BTI는 FLLF · 녹아내리는 소프트콘',
  share_description = '나는 부드럽지만 한쪽으로 스르륵 기대기 쉬운 타입! 내 MEBODY 코드는 FLLF였어요.',
  strategy_key = 'find_support',
  strategy_title = '부드러운 몸에 지지 만들기',
  strategy_summary = '편안하게 기대는 습관을 없애기보다 짧은 시간부터 스스로 중심을 유지하는 경험을 추가하는 방향입니다.',
  primary_axis = 'pelvis',
  secondary_axis = 'flexibility',
  primary_goal = '체중 지지감 만들기',
  secondary_goal = '유연한 움직임 제어하기',
  starter_focus = '["foot_support","basic_stability","weight_shift"]'::jsonb,
  progression_focus = '["single_leg_control","core_control","dynamic_balance"]'::jsonb,
  journey_slug = 'body-reset-find-support',
  journey_title = '흐르는 몸 지지 만들기',
  recommended_start_minutes = 5,
  updated_at = now()
WHERE body_code = 'FLLF';

UPDATE public.body_code_content SET
  character_name = '닻',
  identity_title = '묵직하게 버티는 안정형',
  identity_summary = '상체의 위치는 비교적 안정적으로 유지하면서 하체와 몸통은 단단하게 버티는 움직임이 익숙한 타입입니다.',
  identity_keywords = '["안정","고정","단단함","가동성"]'::jsonb,
  share_title = '내 몸BTI는 CRRS · 닻',
  share_description = '나는 중심을 묵직하게 잡고 버티는 타입! 내 MEBODY 코드는 CRRS였어요.',
  strategy_key = 'mobility_for_stable_body',
  strategy_title = '안정된 몸에 움직임 더하기',
  strategy_summary = '현재의 안정감을 유지하면서 하체와 몸통이 다양한 방향으로 편안하게 움직이는 경험을 늘립니다.',
  primary_axis = 'flexibility',
  secondary_axis = 'pelvis',
  primary_goal = '하체 가동성 경험',
  secondary_goal = '몸통 회전 사용하기',
  starter_focus = '["lower_body_mobility","rotation_mobility","breathing"]'::jsonb,
  progression_focus = '["dynamic_mobility","rotation_control","gait_pattern"]'::jsonb,
  journey_slug = 'body-reset-stable-mobility',
  journey_title = '단단한 몸에 움직임 더하기',
  recommended_start_minutes = 5,
  updated_at = now()
WHERE body_code = 'CRRS';

UPDATE public.body_code_content SET
  character_name = '오뚝이',
  identity_title = '부드럽게 되돌아오는 균형형',
  identity_summary = '비교적 유연하게 움직이며 흔들린 뒤 다시 중심을 찾는 움직임이 나타나기 쉬운 타입입니다.',
  identity_keywords = '["유연함","균형","흔들림","안정"]'::jsonb,
  share_title = '내 몸BTI는 CRRF · 오뚝이',
  share_description = '나는 흔들려도 다시 중심을 찾는 타입! 내 MEBODY 코드는 CRRF였어요.',
  strategy_key = 'stable_control',
  strategy_title = '유연함을 안정감으로 연결하기',
  strategy_summary = '움직임의 자유도를 유지하면서 중심을 잃지 않고 움직임을 끝까지 제어하는 경험을 늘립니다.',
  primary_axis = 'pelvis',
  secondary_axis = 'flexibility',
  primary_goal = '골반과 몸통 제어',
  secondary_goal = '균형 유지 경험',
  starter_focus = '["basic_stability","pelvic_control","foot_support"]'::jsonb,
  progression_focus = '["dynamic_balance","single_leg_control","whole_body_control"]'::jsonb,
  journey_slug = 'body-reset-balanced-control',
  journey_title = '유연한 몸 중심 세우기',
  recommended_start_minutes = 5,
  updated_at = now()
WHERE body_code = 'CRRF';

UPDATE public.body_code_content SET
  character_name = '큐브 탑',
  identity_title = '엇갈려 쌓인 고정형',
  identity_summary = '겉으로는 비교적 안정적으로 보이지만 상체와 하체가 서로 다른 방향으로 움직이는 경향이 나타날 수 있는 타입입니다.',
  identity_keywords = '["엇갈림","고정","회전","가동성"]'::jsonb,
  share_title = '내 몸BTI는 CRLS · 큐브 탑',
  share_description = '나는 안정적으로 보여도 움직임이 엇갈리기 쉬운 타입! 내 MEBODY 코드는 CRLS였어요.',
  strategy_key = 'rotation_reconnect',
  strategy_title = '엇갈린 움직임 다시 연결하기',
  strategy_summary = '상체와 하체를 동시에 억지로 맞추기보다 각각의 편안한 움직임을 만들고 다시 연결하는 방향입니다.',
  primary_axis = 'pelvis',
  secondary_axis = 'flexibility',
  primary_goal = '몸통과 골반 회전 경험',
  secondary_goal = '하체 움직임 여유 만들기',
  starter_focus = '["rotation_mobility","hip_mobility","breathing"]'::jsonb,
  progression_focus = '["cross_body_control","gait_pattern","rotation_control"]'::jsonb,
  journey_slug = 'body-reset-reconnect',
  journey_title = '엇갈린 몸 다시 연결하기',
  recommended_start_minutes = 5,
  updated_at = now()
WHERE body_code = 'CRLS';

UPDATE public.body_code_content SET
  character_name = '중심 귀찮은 문어',
  identity_title = '자유롭게 움직이는 유연형',
  identity_summary = '움직임의 자유도는 높지만 한 위치를 오래 유지하기보다 자세를 자주 바꾸는 것이 편한 타입입니다.',
  identity_keywords = '["유연함","자유로움","움직임","안정"]'::jsonb,
  share_title = '내 몸BTI는 CRLF · 중심 귀찮은 문어',
  share_description = '나는 한 자세보다 자유롭게 움직이는 게 편한 타입! 내 MEBODY 코드는 CRLF였어요.',
  strategy_key = 'control_free_movement',
  strategy_title = '자유로운 움직임에 제어 더하기',
  strategy_summary = '움직임을 제한하는 것이 아니라 자유로운 범위 안에서 시작과 멈춤을 스스로 조절하는 경험을 늘립니다.',
  primary_axis = 'pelvis',
  secondary_axis = 'flexibility',
  primary_goal = '움직임 중 중심 유지',
  secondary_goal = '관절 범위 안에서 제어하기',
  starter_focus = '["basic_stability","core_control","foot_support"]'::jsonb,
  progression_focus = '["dynamic_balance","movement_control","single_leg_control"]'::jsonb,
  journey_slug = 'body-reset-free-control',
  journey_title = '자유로운 몸 중심 잡기',
  recommended_start_minutes = 5,
  updated_at = now()
WHERE body_code = 'CRLF';

UPDATE public.body_code_content SET
  character_name = '엇갈려 잠긴 나무인형',
  identity_title = '엇갈려 단단한 고정형',
  identity_summary = '상체와 하체가 서로 다른 방향을 향하면서 전체 움직임은 단단하게 제한되는 경향이 나타나기 쉬운 타입입니다.',
  identity_keywords = '["엇갈림","단단함","고정","회전"]'::jsonb,
  share_title = '내 몸BTI는 CLRS · 엇갈려 잠긴 나무인형',
  share_description = '나는 몸이 엇갈린 상태에서 단단하게 버티는 타입! 내 MEBODY 코드는 CLRS였어요.',
  strategy_key = 'unlock_cross_pattern',
  strategy_title = '엇갈린 고정 풀어내기',
  strategy_summary = '단단하게 유지하는 패턴에서 벗어나 편안한 좌우 이동과 몸통 회전을 다시 경험하도록 구성합니다.',
  primary_axis = 'shoulder',
  secondary_axis = 'pelvis',
  primary_goal = '상체 움직임 여유 만들기',
  secondary_goal = '골반 회전과 연결하기',
  starter_focus = '["upper_body_mobility","rotation_mobility","breathing"]'::jsonb,
  progression_focus = '["cross_body_control","rotation_control","gait_pattern"]'::jsonb,
  journey_slug = 'body-reset-cross-unlock',
  journey_title = '엇갈린 몸 부드럽게 풀기',
  recommended_start_minutes = 5,
  updated_at = now()
WHERE body_code = 'CLRS';

UPDATE public.body_code_content SET
  character_name = '아슬아슬 젠가 탑',
  identity_title = '유연하게 흔들리는 비대칭형',
  identity_summary = '움직임은 비교적 자유롭지만 한쪽으로 기울거나 흔들리면서 균형을 찾는 경향이 나타나기 쉬운 타입입니다.',
  identity_keywords = '["유연함","비대칭","흔들림","균형"]'::jsonb,
  share_title = '내 몸BTI는 CLRF · 아슬아슬 젠가 탑',
  share_description = '나는 유연하지만 조금씩 흔들리며 균형을 찾는 타입! 내 MEBODY 코드는 CLRF였어요.',
  strategy_key = 'balance_flexible_asymmetry',
  strategy_title = '유연한 비대칭 속 균형 찾기',
  strategy_summary = '유연성을 더 늘리는 것보다 현재 범위 안에서 좌우 체중 이동과 균형을 조절하는 경험을 우선합니다.',
  primary_axis = 'pelvis',
  secondary_axis = 'shoulder',
  primary_goal = '좌우 체중 조절',
  secondary_goal = '상체와 몸통 지지',
  starter_focus = '["weight_shift","basic_stability","scapular_control"]'::jsonb,
  progression_focus = '["dynamic_balance","single_leg_control","whole_body_control"]'::jsonb,
  journey_slug = 'body-reset-flex-balance',
  journey_title = '유연한 몸 균형 찾기',
  recommended_start_minutes = 5,
  updated_at = now()
WHERE body_code = 'CLRF';

UPDATE public.body_code_content SET
  character_name = '한쪽 뿌리 소나무',
  identity_title = '한쪽을 중심으로 버티는 안정형',
  identity_summary = '한쪽을 기준점처럼 사용해 몸의 안정감을 만드는 움직임이 익숙한 타입입니다.',
  identity_keywords = '["한쪽 지지","안정","단단함","균형"]'::jsonb,
  share_title = '내 몸BTI는 CLLS · 한쪽 뿌리 소나무',
  share_description = '나는 한쪽을 뿌리처럼 사용해 중심을 잡는 타입! 내 MEBODY 코드는 CLLS였어요.',
  strategy_key = 'redistribute_support',
  strategy_title = '한쪽 중심에서 양쪽 사용으로',
  strategy_summary = '익숙한 한쪽 지지를 없애기보다 반대쪽을 포함해 양쪽을 번갈아 사용하는 경험을 늘리는 방향입니다.',
  primary_axis = 'pelvis',
  secondary_axis = 'flexibility',
  primary_goal = '좌우 체중 이동 경험',
  secondary_goal = '하체 움직임 다양화',
  starter_focus = '["weight_shift","hip_mobility","foot_support"]'::jsonb,
  progression_focus = '["gait_pattern","balance","single_leg_control"]'::jsonb,
  journey_slug = 'body-reset-bilateral-support',
  journey_title = '한쪽 뿌리에서 양쪽 지지로',
  recommended_start_minutes = 5,
  updated_at = now()
WHERE body_code = 'CLLS';

UPDATE public.body_code_content SET
  character_name = '출렁이는 물침대',
  identity_title = '부드럽게 흔들리는 지지형',
  identity_summary = '몸의 움직임은 비교적 부드럽지만 한쪽으로 체중이 이동할 때 흔들림이 커질 수 있는 타입입니다.',
  identity_keywords = '["유연함","흔들림","체중 이동","안정"]'::jsonb,
  share_title = '내 몸BTI는 CLLF · 출렁이는 물침대',
  share_description = '나는 부드럽게 움직이지만 체중이 옮겨갈 때 흔들리기 쉬운 타입! 내 MEBODY 코드는 CLLF였어요.',
  strategy_key = 'soft_to_stable',
  strategy_title = '부드러움에 안정감 더하기',
  strategy_summary = '부드러운 움직임을 유지하면서 발과 하체에서부터 몸 전체로 안정적인 지지를 연결하는 방향입니다.',
  primary_axis = 'pelvis',
  secondary_axis = 'flexibility',
  primary_goal = '하체 지지감 만들기',
  secondary_goal = '움직임 중 중심 유지',
  starter_focus = '["foot_support","basic_stability","weight_shift"]'::jsonb,
  progression_focus = '["single_leg_control","dynamic_balance","whole_body_control"]'::jsonb,
  journey_slug = 'body-reset-soft-stable',
  journey_title = '출렁임 속 중심 찾기',
  recommended_start_minutes = 5,
  updated_at = now()
WHERE body_code = 'CLLF';

COMMIT;
