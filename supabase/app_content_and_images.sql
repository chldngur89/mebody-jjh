-- ============================================================
-- mebody: 이미지·글·결과 가이드를 Supabase에서 불러오기 위한 테이블
-- Supabase SQL Editor에서 순서대로 실행 후, 데이터를 등록하면 됩니다.
-- ============================================================

-- 1) 이미지 URL 관리 (축 아이콘, 체형별 캐릭터, 16가지 체형 이미지 등)
CREATE TABLE IF NOT EXISTS app_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE app_images IS '앱에서 쓰는 이미지 URL. key로 조회 (axis_neck, character_FRRS, body_types_image 등)';

-- 2) 글/텍스트 콘텐츠 (랜딩 문구, 공지 등)
CREATE TABLE IF NOT EXISTS app_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value_text TEXT,
  value_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT app_content_value_check CHECK (value_text IS NOT NULL OR value_json IS NOT NULL)
);

COMMENT ON TABLE app_content IS '키별 텍스트/JSON 콘텐츠. value_text 또는 value_json 중 하나 필수';

-- 3) 결과 페이지 가이드 (공통 + 체형별 '내몸에 맞는 가이드')
CREATE TABLE IF NOT EXISTS result_guide (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body_code TEXT,
  title TEXT NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE result_guide IS '자세 사용 설명서. body_code NULL = 공통, 값 있으면 해당 체형 전용 가이드';
COMMENT ON COLUMN result_guide.sections IS '[{ "title": "섹션 제목", "content": "내용(**볼드** 가능)" }]';

-- 공통 가이드는 1개만 허용
CREATE UNIQUE INDEX IF NOT EXISTS result_guide_common_one ON result_guide ((1)) WHERE body_code IS NULL;

-- (선택) body_code_content에 캐릭터 이미지 URL 컬럼이 없으면 추가
-- ALTER TABLE body_code_content ADD COLUMN IF NOT EXISTS character_image_url TEXT;

-- ========== RLS (선택 사항: 공개 읽기만 허용) ==========
ALTER TABLE app_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_guide ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_images read" ON app_images FOR SELECT USING (true);
CREATE POLICY "app_content read" ON app_content FOR SELECT USING (true);
CREATE POLICY "result_guide read" ON result_guide FOR SELECT USING (true);

-- ========== 등록용 샘플 데이터 (필요 시 수정 후 실행) ==========

-- 1) app_images: key는 코드에서 사용하는 식별자. url은 Supabase Storage 또는 외부 URL
INSERT INTO app_images (key, url, description) VALUES
  ('axis_neck', '/axis-icons/axis-neck.png', '1축 목 아이콘'),
  ('axis_shoulder', '/axis-icons/axis-shoulder.png', '2축 어깨 아이콘'),
  ('axis_pelvis', '/axis-icons/axis-pelvis.png', '3축 골반 아이콘'),
  ('axis_flexibility', '/axis-icons/axis-flexibility.png', '4축 하체 아이콘'),
  ('body_types_image', '/body-types/bodyTypesImage.png', '16가지 체형 한눈에 보기')
ON CONFLICT (key) DO UPDATE SET url = EXCLUDED.url, updated_at = now();

-- 체형별 캐릭터 이미지 (실제 URL로 교체 후 사용. Supabase Storage 사용 시 public URL 입력)
INSERT INTO app_images (key, url, description) VALUES
  ('character_FRRS', 'https://your-bucket.supabase.co/storage/v1/object/public/images/FRRS.png', 'FRRS 캐릭터'),
  ('character_FRRF', 'https://your-bucket.supabase.co/storage/v1/object/public/images/FRRF.png', 'FRRF 캐릭터'),
  ('character_FRLS', 'https://your-bucket.supabase.co/storage/v1/object/public/images/FRLS.png', 'FRLS 캐릭터'),
  ('character_FRLF', 'https://your-bucket.supabase.co/storage/v1/object/public/images/FRLF.png', 'FRLF 캐릭터'),
  ('character_FLRS', 'https://your-bucket.supabase.co/storage/v1/object/public/images/FLRS.png', 'FLRS 캐릭터'),
  ('character_FLRF', 'https://your-bucket.supabase.co/storage/v1/object/public/images/FLRF.png', 'FLRF 캐릭터'),
  ('character_FLLS', 'https://your-bucket.supabase.co/storage/v1/object/public/images/FLLS.png', 'FLLS 캐릭터'),
  ('character_FLLF', 'https://your-bucket.supabase.co/storage/v1/object/public/images/FLLF.png', 'FLLF 캐릭터'),
  ('character_CRRS', 'https://your-bucket.supabase.co/storage/v1/object/public/images/CRRS.png', 'CRRS 캐릭터'),
  ('character_CRRF', 'https://your-bucket.supabase.co/storage/v1/object/public/images/CRRF.png', 'CRRF 캐릭터'),
  ('character_CRLS', 'https://your-bucket.supabase.co/storage/v1/object/public/images/CRLS.png', 'CRLS 캐릭터'),
  ('character_CRLF', 'https://your-bucket.supabase.co/storage/v1/object/public/images/CRLF.png', 'CRLF 캐릭터'),
  ('character_CLRS', 'https://your-bucket.supabase.co/storage/v1/object/public/images/CLRS.png', 'CLRS 캐릭터'),
  ('character_CLRF', 'https://your-bucket.supabase.co/storage/v1/object/public/images/CLRF.png', 'CLRF 캐릭터'),
  ('character_CLLS', 'https://your-bucket.supabase.co/storage/v1/object/public/images/CLLS.png', 'CLLS 캐릭터'),
  ('character_CLLF', 'https://your-bucket.supabase.co/storage/v1/object/public/images/CLLF.png', 'CLLF 캐릭터')
ON CONFLICT (key) DO UPDATE SET url = EXCLUDED.url, updated_at = now();


-- 2) result_guide: 공통 자세 사용 설명서 (doc 내용 기준). 공통은 1개만 있으므로 두 번 실행해도 한 번만 들어갑니다.
INSERT INTO result_guide (body_code, title, sections, sort_order) VALUES
  (NULL, 'mebody 자세 사용 설명서 (공통)', '[
    {"title": "핵심 원칙", "content": "완벽한 자세보다 중요한 건, 나쁜 자세를 안 하는 것이 아니라 **오래 머무르지 않는 것**입니다. 우리는 로봇이 아니기 때문에 자세가 흐트러질 수 있습니다. 괜찮습니다. 중요한 건 \"지금 내가 이렇게 앉아/서 있구나\" 하고 알아차리는 것입니다. 같은 자세를 오래 반복하면 몸의 조직이 늘어난 상태로 굳어질 수 있어요. (= 크리프 Creep 현상)"},
    {"title": "MEBODY 50% Rule", "content": "**알아차리기** – 무의식 자세를 인식하기\n**절반으로 줄이기** – 예: 다리 꼬기 10번 → 5번\n**반대 방향으로 환기하기** – 잠깐 일어나기 / 반대로 움직이기"},
    {"title": "줄여야 할 4가지 습관", "content": "**1) 다리 꼬기** – 꼬아도 괜찮지만 오래 유지하지 않기 (예: 5분 안에 풀기)\n**2) 짝다리** – 한쪽 다리에만 기대지 말고, 가끔 양발에 체중 나누기\n**3) 한쪽 가방 메기** – 가능하면 백팩, 아니면 번갈아 메기\n**4) 고개 숙여 스마트폰 보기** – 핸드폰을 눈높이 쪽으로 올리고, 고개는 덜 숙이기"},
    {"title": "오늘의 목표", "content": "\"나쁜 자세를 없애기\"가 아니라, \"나쁜 자세에 머무는 시간을 줄이기\""}
  ]'::jsonb, 0)
ON CONFLICT DO NOTHING;

-- (선택) 체형별 '내몸에 맞는 가이드' 추가 예시 – body_code에 'FRRS' 등 지정
-- INSERT INTO result_guide (body_code, title, sections, sort_order) VALUES
--   ('FRRS', 'FRRS 맞춤 자세 가이드', '[{"title": "이 체형에게 추천", "content": "..."}]'::jsonb, 0);


-- ========== 등록/수정 시 updated_at 자동 갱신 ==========
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_images_updated_at ON app_images;
CREATE TRIGGER app_images_updated_at BEFORE UPDATE ON app_images
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS app_content_updated_at ON app_content;
CREATE TRIGGER app_content_updated_at BEFORE UPDATE ON app_content
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS result_guide_updated_at ON result_guide;
CREATE TRIGGER result_guide_updated_at BEFORE UPDATE ON result_guide
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
