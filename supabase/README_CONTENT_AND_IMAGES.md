# Supabase 현재 구성 안내

이 폴더는 현재 앱에서 실제로 쓰는 SQL과 검증 문서만 유지합니다. `doc` 폴더의 원본 기획 파일은 건드리지 않습니다.

## 실행 대상 SQL
현재 유지하는 SQL 파일:
- `app_content_and_images.sql`: 앱 콘텐츠, 이미지 키, 결과 가이드 기본 데이터
- `auth_membership_and_revisit.sql`: 프로필, 멤버십, 구독, 결과 재방문용 컬럼
- `body_code_result_sections_15codes.sql`: 결과 하단 섹션 콘텐츠
- `fix_app_images_cleanup.sql`: 잘못된 이미지 URL 정리
- `questionnaire_responses_rls.sql`: 결과 테이블 RLS 초안
- `ver6_immediate_action.sql`: Ver6 즉시 액션 테이블 3개와 데이터

현재 삭제한 구버전 SQL은 다시 실행하지 않습니다.

## 앱이 읽는 주요 테이블
- `questions`
- `questionnaire_responses`
- `body_code_content`
- `result_guide`
- `body_code_next_page`
- `body_code_result_sections`
- `app_content`
- `app_images`
- `immediate_action_discomfort_mapping`
- `immediate_action_axis_mapping`
- `immediate_action_content`
- `user_profiles`
- `membership_plans`
- `user_subscriptions`

## Ver6 즉시 액션 연결
`ver6_immediate_action.sql`은 아래 테이블을 만듭니다.
- `immediate_action_discomfort_mapping`
- `immediate_action_axis_mapping`
- `immediate_action_content`

앱은 실제 답변과 4축 퍼센티지를 기준으로 1순위/2순위 액션을 계산한 뒤 위 테이블의 `content_key`를 조회합니다.

검증 SQL:
```sql
SELECT
  (SELECT count(*) FROM public.immediate_action_discomfort_mapping WHERE is_active = true) AS discomfort_mapping_count,
  (SELECT count(*) FROM public.immediate_action_axis_mapping WHERE is_active = true) AS axis_mapping_count,
  (SELECT count(*) FROM public.immediate_action_content) AS action_content_count;
```

## 이미지 정책
Storage bucket 이름은 `images`입니다.

폴더 구조:
```text
images/
  axis/
    axis-neck.png
    axis-shoulder.png
    axis-pelvis.png
    axis-flexibility.png
  body-types/
    bodyTypesImage.png
  characters/
    FRRS.png
    FRRF.png
    FRLS.png
    FRLF.png
    FLRS.png
    FLRF.png
    FLLS.png
    FLLF.png
    CRRS.png
    CRRF.png
    CRLS.png
    CRLF.png
    CLRS.png
    CLRF.png
    CLLS.png
    CLLF.png
```

캐릭터 이미지는 Storage `characters/{BODY_CODE}.png`를 우선 사용합니다. 실패할 때만 `app_images`와 로컬 fallback으로 내려갑니다.

## 최소 검증 순서
1. `.env`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`가 있는지 확인합니다.
2. `npm run build`가 성공하는지 확인합니다.
3. 앱에서 53문항 건너뛰기를 실행합니다.
4. 결과 페이지에서 캐릭터 이미지와 4축 그래프가 정상인지 확인합니다.
5. 코드 플랜에서 1순위/2순위 액션이 실제 데이터로 표시되는지 확인합니다.
6. 액션 상세 모달을 열어 이완/스트레칭 콘텐츠가 보이는지 확인합니다.
