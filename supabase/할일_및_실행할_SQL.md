# mebody Supabase – 할 일 및 실행할 SQL

## 1. 할 일 요약

| 순서 | 할 일 | 비고 |
|------|--------|------|
| 1 | **Supabase 대시보드** → **SQL Editor** 이동 | |
| 2 | 아래 **「2. 실행할 SQL 전체」** 블록을 **전부 복사**해서 SQL Editor에 붙여넣기 | |
| 3 | **Run** 실행 (한 번만 실행하면 됨) | 기존 `body_code_content`, `questionnaire_responses`, `questions`는 건드리지 않음 |
| 4 | (선택) 캐릭터 이미지를 Storage로 쓰려면 `app_images` 테이블에서 `character_*` 행의 `url`만 실제 URL로 수정 | Table Editor에서 수정 가능 |
| 5 | (선택) 체형별 ‘내몸에 맞는 가이드’가 필요하면 아래 **「3. 체형별 가이드 추가 SQL」** 실행 | `body_code`만 바꿔서 반복 |

---

## 2. 실행할 SQL 전체

아래 전체를 복사해서 Supabase SQL Editor에 붙여넣고 **Run** 하세요.

```sql
-- ============================================================
-- mebody: 새 테이블 3개만 추가 (기존 body_code_content, questionnaire_responses, questions 는 그대로 둠)
-- Supabase SQL Editor에서 전체 선택 후 Run 한 번 실행
-- ============================================================

-- 1) 이미지 URL 관리
CREATE TABLE IF NOT EXISTS app_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE app_images IS '앱 이미지 URL. key 예: axis_neck, character_FRRS, body_types_image';

-- 2) 글/텍스트 콘텐츠 (필요 시 사용)
CREATE TABLE IF NOT EXISTS app_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value_text TEXT,
  value_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT app_content_value_check CHECK (value_text IS NOT NULL OR value_json IS NOT NULL)
);

-- 3) 결과 페이지 가이드 (공통 + 체형별)
CREATE TABLE IF NOT EXISTS result_guide (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body_code TEXT,
  title TEXT NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE result_guide IS '자세 사용 설명서. body_code NULL=공통, FRRS 등=체형별';
COMMENT ON COLUMN result_guide.sections IS '[{"title":"제목","content":"내용(**볼드** 가능)"}]';

-- 공통 가이드는 1개만
CREATE UNIQUE INDEX IF NOT EXISTS result_guide_common_one ON result_guide ((1)) WHERE body_code IS NULL;

-- RLS: 읽기 허용
ALTER TABLE app_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_guide ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_images read" ON app_images FOR SELECT USING (true);
CREATE POLICY "app_content read" ON app_content FOR SELECT USING (true);
CREATE POLICY "result_guide read" ON result_guide FOR SELECT USING (true);

-- ---------- 초기 데이터: app_images ----------
INSERT INTO app_images (key, url, description) VALUES
  ('axis_neck', '/axis-icons/axis-neck.png', '1축 목 아이콘'),
  ('axis_shoulder', '/axis-icons/axis-shoulder.png', '2축 어깨 아이콘'),
  ('axis_pelvis', '/axis-icons/axis-pelvis.png', '3축 골반 아이콘'),
  ('axis_flexibility', '/axis-icons/axis-flexibility.png', '4축 하체 아이콘'),
  ('body_types_image', '/body-types/bodyTypesImage.png', '16가지 체형 한눈에 보기')
ON CONFLICT (key) DO UPDATE SET url = EXCLUDED.url, updated_at = now();

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

-- ---------- 초기 데이터: result_guide (공통 가이드 1건) ----------
INSERT INTO result_guide (body_code, title, sections, sort_order) VALUES
  (NULL, 'mebody 자세 사용 설명서 (공통)', '[
    {"title": "핵심 원칙", "content": "완벽한 자세보다 중요한 건, 나쁜 자세를 안 하는 것이 아니라 **오래 머무르지 않는 것**입니다. 우리는 로봇이 아니기 때문에 자세가 흐트러질 수 있습니다. 괜찮습니다. 중요한 건 \"지금 내가 이렇게 앉아/서 있구나\" 하고 알아차리는 것입니다. 같은 자세를 오래 반복하면 몸의 조직이 늘어난 상태로 굳어질 수 있어요. (= 크리프 Creep 현상)"},
    {"title": "MEBODY 50% Rule", "content": "**알아차리기** – 무의식 자세를 인식하기\n**절반으로 줄이기** – 예: 다리 꼬기 10번 → 5번\n**반대 방향으로 환기하기** – 잠깐 일어나기 / 반대로 움직이기"},
    {"title": "줄여야 할 4가지 습관", "content": "**1) 다리 꼬기** – 꼬아도 괜찮지만 오래 유지하지 않기 (예: 5분 안에 풀기)\n**2) 짝다리** – 한쪽 다리에만 기대지 말고, 가끔 양발에 체중 나누기\n**3) 한쪽 가방 메기** – 가능하면 백팩, 아니면 번갈아 메기\n**4) 고개 숙여 스마트폰 보기** – 핸드폰을 눈높이 쪽으로 올리고, 고개는 덜 숙이기"},
    {"title": "오늘의 목표", "content": "\"나쁜 자세를 없애기\"가 아니라, \"나쁜 자세에 머무는 시간을 줄이기\""}
  ]'::jsonb, 0)
ON CONFLICT DO NOTHING;

-- ---------- updated_at 자동 갱신 트리거 ----------
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
```

---

## 3. (선택) 체형별 가이드 추가 SQL

체형별로 “내몸에 맞는 가이드”를 넣을 때만 사용하세요. `body_code`와 `title`, `sections` 내용만 바꿔서 실행하면 됩니다.

```sql
-- 예: FRRS 체형 가이드 1건 추가 (다른 코드는 FRRS 부분만 CRRF, FRLS 등으로 바꿔서 반복)
INSERT INTO result_guide (body_code, title, sections, sort_order) VALUES
  ('FRRS', 'FRRS 맞춤 자세 가이드', '[
    {"title": "이 체형에게 추천", "content": "목을 중앙에 두는 습관을 **50% Rule**로 줄여보세요."},
    {"title": "주의할 점", "content": "한 자세를 오래 유지하지 마세요."}
  ]'::jsonb, 0);
```

---

## 4. 참고

- **기존 테이블**: `body_code_content`, `questionnaire_responses`, `questions`는 **수정·TRUNCATE 하지 않습니다.** 그대로 두고 사용하면 됩니다.
- **캐릭터 이미지**: 위 SQL의 `character_*` url은 예시입니다. Supabase Storage에 이미지 올린 뒤 Table Editor에서 `app_images` 테이블의 해당 행 `url`만 실제 공개 URL로 바꾸면 됩니다. URL 안 바꿔도 앱은 로컬 이미지로 fallback 합니다.
- **트리거 오류**: `EXECUTE FUNCTION` 문에서 오류 나면(구버전 Postgres) 해당 CREATE TRIGGER 세 줄을 지우고 실행해도 됩니다. `updated_at`만 수동으로 갱신하면 됩니다.
