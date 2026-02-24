# 이미지·글·결과 가이드 Supabase 등록 안내

## 1. 테이블 생성 및 초기 데이터

Supabase 대시보드 → **SQL Editor**에서 `app_content_and_images.sql` 파일 내용을 **순서대로** 실행하세요.

- `app_images`: 이미지 URL (축 아이콘, 체형별 캐릭터, 16가지 체형 이미지)
- `app_content`: 글/텍스트 콘텐츠 (키별, 필요 시 사용)
- `result_guide`: 자세 사용 설명서 (공통 + 체형별 ‘내몸에 맞는 가이드’)

실행 후 공통 가이드 1건과 이미지 키 샘플이 들어갑니다.

## 2. 이미지 등록 (app_images)

- **key**: 코드에서 사용하는 식별자
  - 축 아이콘: `axis_neck`, `axis_shoulder`, `axis_pelvis`, `axis_flexibility`
  - 16가지 체형 한 장: `body_types_image`
  - 체형별 캐릭터: `character_FRRS`, `character_FRRF`, … `character_CLLF`
- **url**: 이미지 주소 (Supabase Storage 공개 URL 또는 외부 URL)

로컬 경로(`/axis-icons/...`)를 쓰면 현재 도메인 기준으로 로드됩니다. Supabase Storage에 올리면 해당 버킷의 public URL로 바꾸면 됩니다.

## 3. 결과 가이드 등록 (result_guide)

- **공통 가이드**: `body_code = NULL` 1건 (이미 SQL에 포함)
- **체형별 ‘내몸에 맞는 가이드’**: `body_code`에 `FRRS`, `CRRF` 등 4글자 코드 지정

예시 (체형별 가이드 1건 추가):

```sql
INSERT INTO result_guide (body_code, title, sections, sort_order) VALUES
  ('FRRS', 'FRRS 맞춤 자세 가이드', '[
    {"title": "이 체형에게 추천", "content": "목을 중앙에 두는 습관을 **50% Rule**로 줄여보세요."},
    {"title": "주의할 점", "content": "한 자세를 오래 유지하지 마세요."}
  ]'::jsonb, 0);
```

- **sections**: `[{"title": "섹션 제목", "content": "내용(**볼드** 가능)"}]` 형식의 JSON 배열
- 앱에서는 해당 체형 가이드가 있으면 그걸 보여주고, 없으면 공통 가이드를 보여줍니다.

## 4. 글 콘텐츠 (app_content, 선택)

랜딩 문구 등 텍스트를 DB로 관리하려면:

```sql
INSERT INTO app_content (key, value_text) VALUES
  ('landing_title', '나의 바디 코드를 발견하세요');
```

- **key**: 앱에서 조회할 키
- **value_text**: 일반 텍스트
- **value_json**: JSON 형태 데이터 필요 시 사용

현재 앱은 `fetchAppContent()`로 조회할 수 있도록 API만 준비되어 있으며, 화면 연동은 필요 시 추가하면 됩니다.
