# MEBODY

MEBODY는 4개 사전체크와 49개 본문 문항으로 현재 몸의 정렬 패턴을 기록하고, 4축 기반 mebody 코드와 후속 코드 플랜을 제공하는 모바일 중심 웹앱입니다.

## 현재 제품 흐름
- 랜딩
- 안내 및 동의
- 측정 기준 안내
- 53문항 설문: 사전체크 4개 + 본문 49개
- 분석 중 화면
- 무료 결과 페이지
- 코드 플랜
- 자세 사용 설명서
- 내 코드 더 알아보기
- 회원가입 / 로그인
- 마이페이지
- 멤버십 / 체크아웃 mock

임시 검증용 버튼은 남겨둡니다. 운영 전에는 실제 회원/결제 흐름이 붙은 뒤 제거 여부를 다시 판단합니다.

## 기술 스택
- React 18
- TypeScript
- Vite 6
- Supabase JS Client
- lucide-react
- Vercel 배포

PWA 캐싱은 제거했습니다. [public/sw.js](./public/sw.js)는 과거 배포에서 등록된 service worker를 해제하기 위한 cleanup 파일입니다.

## 실행 방법
### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정
`.env` 또는 Vercel Environment Variables에 아래 값을 설정합니다.

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### 3. 개발 서버
```bash
npm run dev -- --host 127.0.0.1
```

기본 주소는 [http://127.0.0.1:3000](http://127.0.0.1:3000) 입니다.

### 4. 빌드
```bash
npm run build
```

### 5. 빌드 미리보기
```bash
npm run preview
```

## Vercel 배포 기준
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- 필수 환경변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Vercel 빌드 로그의 `Some chunks are larger than 500 kB`는 현재 실패가 아니라 경고입니다. 현재 `vite.config.ts`에서 경고 기준을 900 kB로 올려둔 상태이고, 실제 최적화는 라우트 단위 코드 스플리팅을 할 때 처리합니다.

## 현재 코드 구조
주요 진입점:
- [src/App.tsx](./src/App.tsx): 화면 전환, 부트스트랩, 결과 기억 정책
- [src/main.tsx](./src/main.tsx): React mount, 과거 service worker/cache 정리

주요 화면:
- [src/components/LandingScreen.tsx](./src/components/LandingScreen.tsx)
- [src/components/ConsentScreen.tsx](./src/components/ConsentScreen.tsx)
- [src/components/DiagnosisIntroScreen.tsx](./src/components/DiagnosisIntroScreen.tsx)
- [src/components/QuestionnaireScreen.tsx](./src/components/QuestionnaireScreen.tsx)
- [src/components/AnalyzingScreen.tsx](./src/components/AnalyzingScreen.tsx)
- [src/components/ResultScreen.tsx](./src/components/ResultScreen.tsx)
- [src/components/CodePlanScreen.tsx](./src/components/CodePlanScreen.tsx)
- [src/components/CommonGuideScreen.tsx](./src/components/CommonGuideScreen.tsx)
- [src/components/CodeDetailsScreen.tsx](./src/components/CodeDetailsScreen.tsx)
- [src/components/AuthScreen.tsx](./src/components/AuthScreen.tsx)
- [src/components/MyPageScreen.tsx](./src/components/MyPageScreen.tsx)
- [src/components/MembershipScreen.tsx](./src/components/MembershipScreen.tsx)
- [src/components/CheckoutScreen.tsx](./src/components/CheckoutScreen.tsx)

주요 로직:
- [src/api/questionnaire.ts](./src/api/questionnaire.ts): 문항 조회, 응답 저장, 결과 조회
- [src/api/account.ts](./src/api/account.ts): 프로필, 최근 결과, 멤버십 조회
- [src/api/content.ts](./src/api/content.ts): 콘텐츠, 이미지, Ver6 액션 데이터 조회
- [src/utils/bodyCodeCalculator.ts](./src/utils/bodyCodeCalculator.ts): 4축 mebody 코드 계산
- [src/utils/characterImages.ts](./src/utils/characterImages.ts): Supabase Storage 우선 캐릭터 이미지 해석
- [src/utils/axisIcons.ts](./src/utils/axisIcons.ts): 축 아이콘 이미지 해석

## Supabase 사용 범위
현재 앱이 사용하는 주요 테이블:
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

현재 유지하는 SQL 파일:
- [supabase/app_content_and_images.sql](./supabase/app_content_and_images.sql)
- [supabase/auth_membership_and_revisit.sql](./supabase/auth_membership_and_revisit.sql)
- [supabase/body_code_result_sections_15codes.sql](./supabase/body_code_result_sections_15codes.sql)
- [supabase/fix_app_images_cleanup.sql](./supabase/fix_app_images_cleanup.sql)
- [supabase/questionnaire_responses_rls.sql](./supabase/questionnaire_responses_rls.sql)
- [supabase/ver6_immediate_action.sql](./supabase/ver6_immediate_action.sql)

## 이미지 규칙
Supabase Storage bucket 이름은 `images`입니다.

Storage 경로:
- 캐릭터: `characters/{BODY_CODE}.png`
- 축 아이콘: `axis/axis-neck.png`
- 축 아이콘: `axis/axis-shoulder.png`
- 축 아이콘: `axis/axis-pelvis.png`
- 축 아이콘: `axis/axis-flexibility.png`
- 16가지 체형 이미지: `body-types/bodyTypesImage.png`

캐릭터 이미지는 Storage를 우선 사용하고, 실패하면 `app_images`, 마지막으로 로컬 fallback을 사용합니다.

## 결과 기억 정책
- 비회원: 현재 탭의 `sessionStorage`에만 결과 id를 보관합니다.
- 비회원: 새 탭, 새 브라우저, 공유 URL 단독 진입은 랜딩으로 보냅니다.
- 로그인 사용자: `questionnaire_responses.user_id` 기준으로 최신 결과를 불러옵니다.
- Supabase Auth 세션은 그대로 유지합니다.

## 현재 구현 완료
- 53문항 설문 로딩 및 저장
- 사전체크 4개와 본문 49개 문항 UI 처리
- 4축 기반 mebody 코드 계산
- 결과 페이지와 코드 플랜 분리
- Ver6 즉시 액션 데이터 조회 및 1순위/2순위 액션 UI
- 액션 상세 모달과 미션 수행률 0% / 50% / 100% 흐름
- 자세 사용 설명서와 내 코드 더 알아보기 화면
- 결과 페이지 하단 16가지 체형 이미지, 유튜브 카드, mock store
- Supabase Storage 이미지 우선 로딩
- 로그인 사용자의 최근 결과 코드 플랜 풀스크린 모달
- 회원가입 / 로그인 / 마이페이지 / 멤버십 mock UI
- 비회원 첫 진입은 항상 랜딩으로 고정
- 과거 service worker/cache cleanup

## 검증 체크리스트
```bash
npm run build
git diff --check
```

브라우저에서 확인할 흐름:
- 비회원 새 접속이 랜딩에서 시작하는지 확인
- 53문항 건너뛰기 후 결과와 코드 플랜이 최신 액션 UI로 나오는지 확인
- 53문항 정상 완료 후에도 같은 코드 플랜 UI로 나오는지 확인
- 미션 카드 클릭 시 0% -> 50% -> 100% 흐름이 정상인지 확인
- 100%에서 미션 영역을 누르면 액션 전체 보기가 열리는지 확인
- 비회원 새 탭에서는 이전 결과가 자동 복원되지 않는지 확인
- 로그인 후에는 최근 결과 바로 보기가 Supabase 결과 기준으로 노출되는지 확인

## 다음 작업
다음 작업은 [TODO.md](./TODO.md)에 정리했습니다. 결제/회원 보안 계획은 [docs/member-auth-billing-plan.md](./docs/member-auth-billing-plan.md)에 유지합니다.
