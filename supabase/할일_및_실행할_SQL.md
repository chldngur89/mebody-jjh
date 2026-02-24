# mebody Supabase – SQL 실행 안내 (복사해서 사용)

Supabase 대시보드 → **SQL Editor**에서 아래 블록을 **순서대로 복사 → 붙여넣기 → Run** 하세요.

---

## 실행 순서

| 순서 | 할 일 | 아래 섹션 |
|------|--------|-----------|
| 1 | **필수** 기본 테이블 + 공통 가이드 한 번 실행 | [A. 필수 – 한 번만 실행](#a-필수--한-번만-실행) |
| 2 | (선택) 결과 페이지 0~5 아코디언 테이블 | [B. 결과 아코디언 테이블](#b-선택-결과-아코디언-테이블) |
| 3 | (선택) 다음 페이지 테이블 + 예시 1개 | [C. 다음 페이지 테이블](#c-선택-다음-페이지-테이블) |
| 4 | (선택) 체형별 가이드/데이터 추가 | [D, E] |

---

## A. 필수 – 한 번만 실행

**아래 전체를 복사** → SQL Editor 붙여넣기 → **Run**.

```sql
-- ========== mebody 필수 테이블 (한 번만 실행) ==========
-- app_images, app_content, result_guide + 공통 가이드 1건

CREATE TABLE IF NOT EXISTS app_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE app_images IS '앱 이미지 URL. key: axis_neck, character_FRRS, body_types_image';

CREATE TABLE IF NOT EXISTS app_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value_text TEXT,
  value_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT app_content_value_check CHECK (value_text IS NOT NULL OR value_json IS NOT NULL)
);

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
CREATE UNIQUE INDEX IF NOT EXISTS result_guide_common_one ON result_guide ((1)) WHERE body_code IS NULL;

ALTER TABLE app_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_guide ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_images read" ON app_images FOR SELECT USING (true);
CREATE POLICY "app_content read" ON app_content FOR SELECT USING (true);
CREATE POLICY "result_guide read" ON result_guide FOR SELECT USING (true);

INSERT INTO app_images (key, url, description) VALUES
  ('axis_neck', '/axis-icons/axis-neck.png', '1축 목'),
  ('axis_shoulder', '/axis-icons/axis-shoulder.png', '2축 어깨'),
  ('axis_pelvis', '/axis-icons/axis-pelvis.png', '3축 골반'),
  ('axis_flexibility', '/axis-icons/axis-flexibility.png', '4축 하체'),
  ('body_types_image', '/body-types/bodyTypesImage.png', '16가지 체형')
ON CONFLICT (key) DO UPDATE SET url = EXCLUDED.url, updated_at = now();

INSERT INTO app_images (key, url, description) VALUES
  ('character_FRRS', 'https://your-bucket.supabase.co/storage/v1/object/public/images/FRRS.png', 'FRRS'),
  ('character_FRRF', 'https://your-bucket.supabase.co/storage/v1/object/public/images/FRRF.png', 'FRRF'),
  ('character_FRLS', 'https://your-bucket.supabase.co/storage/v1/object/public/images/FRLS.png', 'FRLS'),
  ('character_FRLF', 'https://your-bucket.supabase.co/storage/v1/object/public/images/FRLF.png', 'FRLF'),
  ('character_FLRS', 'https://your-bucket.supabase.co/storage/v1/object/public/images/FLRS.png', 'FLRS'),
  ('character_FLRF', 'https://your-bucket.supabase.co/storage/v1/object/public/images/FLRF.png', 'FLRF'),
  ('character_FLLS', 'https://your-bucket.supabase.co/storage/v1/object/public/images/FLLS.png', 'FLLS'),
  ('character_FLLF', 'https://your-bucket.supabase.co/storage/v1/object/public/images/FLLF.png', 'FLLF'),
  ('character_CRRS', 'https://your-bucket.supabase.co/storage/v1/object/public/images/CRRS.png', 'CRRS'),
  ('character_CRRF', 'https://your-bucket.supabase.co/storage/v1/object/public/images/CRRF.png', 'CRRF'),
  ('character_CRLS', 'https://your-bucket.supabase.co/storage/v1/object/public/images/CRLS.png', 'CRLS'),
  ('character_CRLF', 'https://your-bucket.supabase.co/storage/v1/object/public/images/CRLF.png', 'CRLF'),
  ('character_CLRS', 'https://your-bucket.supabase.co/storage/v1/object/public/images/CLRS.png', 'CLRS'),
  ('character_CLRF', 'https://your-bucket.supabase.co/storage/v1/object/public/images/CLRF.png', 'CLRF'),
  ('character_CLLS', 'https://your-bucket.supabase.co/storage/v1/object/public/images/CLLS.png', 'CLLS'),
  ('character_CLLF', 'https://your-bucket.supabase.co/storage/v1/object/public/images/CLLF.png', 'CLLF')
ON CONFLICT (key) DO UPDATE SET url = EXCLUDED.url, updated_at = now();

INSERT INTO result_guide (body_code, title, sections, sort_order) VALUES
  (NULL, 'mebody 자세 사용 설명서 (공통)', '[
    {"title": "핵심 원칙", "content": "완벽한 자세보다 중요한 건, 나쁜 자세를 안 하는 것이 아니라 **오래 머무르지 않는 것**입니다. 우리는 로봇이 아니기 때문에 자세가 흐트러질 수 있습니다. 괜찮습니다. 중요한 건 \"지금 내가 이렇게 앉아/서 있구나\" 하고 알아차리는 것입니다. 같은 자세를 오래 반복하면 몸의 조직이 늘어난 상태로 굳어질 수 있어요. (= 크리프(Creep) 현상)"},
    {"title": "MEBODY 50% Rule", "content": "**알아차리기** – 무의식 자세를 인식하기\n**절반으로 줄이기** – 예: 다리 꼬기 10번 → 5번\n**반대 방향으로 환기하기** – 잠깐 일어나기 / 반대로 움직이기"},
    {"title": "줄여야 할 4가지 습관", "content": "**1) 다리 꼬기** – 꼬아도 괜찮지만 오래 유지하지 않기 (예: 5분 안에 풀기)\n**2) 짝다리** – 한쪽 다리에만 기대지 말고, 가끔 양발에 체중 나누기\n**3) 한쪽 가방 메기** – 가능하면 백팩, 아니면 번갈아 메기\n**4) 고개 숙여 스마트폰 보기** – 핸드폰을 눈높이 쪽으로 올리고, 고개는 덜 숙이기"},
    {"title": "오늘의 목표", "content": "\"나쁜 자세를 없애기\"가 아니라, \"나쁜 자세에 머무는 시간을 줄이기\""}
  ]'::jsonb, 0)
ON CONFLICT DO NOTHING;

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

> ⚠️ `EXECUTE FUNCTION` 오류 나면 → `EXECUTE PROCEDURE`로 바꾸거나, CREATE TRIGGER 세 줄 삭제 후 실행.

---

## B. (선택) 결과 아코디언 테이블

결과 화면 **0)~5) 아코디언** 글을 DB에서 쓰려면 실행. 아래 **전체 복사** → Run.

```sql
-- ========== 결과 페이지 0~5 아코디언 (체형별 긴 글 저장) ==========
-- section_key: 0=알아보기, 1=한눈에보기, 2=이해포인트, 3=공감포인트, 4=주의자세, 5=자가루틴

CREATE TABLE IF NOT EXISTS body_code_result_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body_code TEXT NOT NULL,
  section_key TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(body_code, section_key)
);
COMMENT ON TABLE body_code_result_sections IS '결과 아코디언 0~5. content에 긴 글·워드 내용 넣기';
COMMENT ON COLUMN body_code_result_sections.content IS '**볼드** 지원';

ALTER TABLE body_code_result_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "body_code_result_sections read" ON body_code_result_sections FOR SELECT USING (true);

DROP TRIGGER IF EXISTS body_code_result_sections_updated_at ON body_code_result_sections;
CREATE TRIGGER body_code_result_sections_updated_at BEFORE UPDATE ON body_code_result_sections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### B-1. 결과 아코디언 – FRRS 예시 데이터 (복사해서 Run)

다른 체형은 `'FRRS'`를 `'FRRF'`, `'FRLS'` 등으로 바꾸고 `title`, `content`만 수정해서 반복 실행하면 됩니다.

```sql
INSERT INTO body_code_result_sections (body_code, section_key, title, content, sort_order) VALUES
  ('FRRS', '0', '내 체형 코드(FRRS)에 대해서 알아보기', '당신의 체형 코드는 **FRRS**입니다. 이 코드는 4가지 축(목·어깨·골반·하체)에서의 움직임 경향을 요약한 것입니다. 아래에서 한눈에 보기, 이해 포인트, 공감 포인트, 주의 자세, 무료 자가 루틴을 확인하세요.', 0),
  ('FRRS', '1', '한눈에 보는 내 코드', '목은 앞으로 나와 보이기 쉬운 편(F)
오른쪽 어깨가 올라가 보일 수 있음(R)
몸 중심(골반/허리 아래)이 오른쪽으로 돌아가 보일 수 있음(R)
하체는 뻣뻣·단단하게 버티는 편(S)', 1),
  ('FRRS', '2', '이해 포인트', '**단단하게 버티며 균형 잡기**가 **부드럽게 풀기**보다 익숙한 패턴일 수 있습니다. 이 경향이 목·어깨 긴장이나 한쪽 다리 선호로 이어질 수 있어요.', 2),
  ('FRRS', '3', '공감 포인트', '서 있을 때 한쪽 다리에 체중이 실리기, 무릎을 꽉 잠그는 게 편함, 화면 볼 때 턱이 나옴, 회전 움직임이 뻣뻣하게 느껴짐 등이 해당될 수 있습니다.', 3),
  ('FRRS', '4', '지금 주의하면 좋은 자세', '무릎 꽉 잠그고 서 있기, 한쪽 힙만 밀어내기, 화면 볼 때 턱 내밀기, 한 방향으로만 다리 꼬기, 어깨·팔 근육만 과하게 쓰기 등을 줄여보세요.', 4),
  ('FRRS', '5', '무료 10~15분 자가 루틴', '**목표**: 버티기만 하는 패턴 → 부드럽게 움직이고 다시 잡는 패턴

1단계(3분): 종아리·허벅지 앞쪽 가볍게 풀기
2단계(3분): 골반·허리 회전 움직임 넣기
3단계(3분): 어깨·목 이완
4단계(3분): 전신 호흡·정리

(차후 영상 촬영 후 자가 루틴 사진·영상 첨부 예정)', 5)
ON CONFLICT (body_code, section_key) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
```

---

## C. (선택) 다음 페이지 테이블

"다음 페이지"에서 체형별 맞춤 콘텐츠를 보여줄 때 사용. **전체 복사** → Run.

```sql
-- ========== 다음 페이지 – 체형별 맞춤 ==========
CREATE TABLE IF NOT EXISTS body_code_next_page (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON COLUMN body_code_next_page.sections IS '[{"title":"소제목","content":"내용(**볼드** 가능)"}]';

ALTER TABLE body_code_next_page ENABLE ROW LEVEL SECURITY;
CREATE POLICY "body_code_next_page read" ON body_code_next_page FOR SELECT USING (true);
```

### C-1. 다음 페이지 – FRRS 예시 (복사해서 Run)

`body_code`, `title`, `sections` 내용만 바꿔서 다른 체형 추가.

```sql
INSERT INTO body_code_next_page (body_code, title, sections) VALUES
  ('FRRS', 'FRRS 맞춤 가이드', '[
    {"title": "이 체형의 특징", "content": "몸이 뻣뻣하고(Lock) 머리가 몸보다 앞서 나가는 경향이 있습니다."},
    {"title": "추천 습관", "content": "**50% Rule**로 목·어깨에 머무는 시간을 줄여보세요."}
  ]'::jsonb)
ON CONFLICT (body_code) DO UPDATE SET
  title = EXCLUDED.title,
  sections = EXCLUDED.sections,
  updated_at = now();
```

---

## D. (선택) 체형별 자세 가이드 1건 추가

`result_guide`에 체형별 "내몸에 맞는 가이드" 넣을 때. **FRRS**만 바꿔서 다른 코드 반복.

```sql
INSERT INTO result_guide (body_code, title, sections, sort_order) VALUES
  ('FRRS', 'FRRS 맞춤 자세 가이드', '[
    {"title": "이 체형에게 추천", "content": "목을 중앙에 두는 습관을 **50% Rule**로 줄여보세요."},
    {"title": "주의할 점", "content": "한 자세를 오래 유지하지 마세요."}
  ]'::jsonb, 0);
```

---

## E. 참고

- **콘텐츠 출처**: 공통/체형별 글은 **워드 문서**에서 정리한 뒤 위 테이블(`result_guide`, `body_code_next_page`, `body_code_result_sections`)에 INSERT하면 됩니다. 앱은 .docx를 직접 읽지 않습니다.
- **기존 테이블**: `body_code_content`, `questionnaire_responses`, `questions`는 건드리지 마세요.
- **이미지 URL**: `app_images`의 `character_*` 행은 예시 URL입니다. Storage에 올린 뒤 Table Editor에서 `url`만 실제 주소로 바꾸면 됩니다.
