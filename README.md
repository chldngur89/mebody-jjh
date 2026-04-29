# MEBODY

MEBODY는 40문항 설문으로 4축 체형 패턴을 분석하고, 16가지 body code와 후속 가이드 화면을 제공하는 모바일 중심 웹앱입니다.

## 현재 상태
- React + TypeScript + Vite 기반 단일 프론트엔드 앱
- Supabase로 질문/결과/콘텐츠/이미지/인증 데이터를 읽고 저장
- Vercel 배포 기준으로 동작
- 모바일 1페이지 플로우 중심으로 UI를 재정리한 상태

현재 구현된 핵심 흐름:
- 랜딩
- 안내 및 동의
- 40문항 설문
- 분석 중 화면
- 결과 페이지
- 코드 플랜
- 자세 사용 설명서
- 내 코드 더 알아보기
- 회원가입 / 로그인
- 멤버십 / 체크아웃(가상 결제 단계)
- 마이페이지

## 기술 스택
- React 18
- TypeScript
- Vite 6
- Supabase JS Client
- lucide-react
- vite-plugin-pwa

## 실행 방법
### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정
`.env` 또는 `.env.production`에 아래 값을 넣습니다.

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### 3. 개발 서버 실행
```bash
npm run dev
```

기본 개발 주소:
- [http://localhost:3000](http://localhost:3000)

### 4. 프로덕션 빌드
```bash
npm run build
```

### 5. 빌드 미리보기
```bash
npm run preview
```

## 배포
현재 배포 전제:
- Vercel
- Output Directory: `dist`
- Build Command: `npm run build`

필수 환경변수:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

참고:
- PWA 캐시가 켜져 있어서 배포 직후 예전 화면이 남아 보일 수 있습니다.
- 이 경우 강력 새로고침 또는 서비스워커 갱신이 필요합니다.

## 현재 앱 구조
주요 화면 컴포넌트:
- `src/components/LandingScreen.tsx`
- `src/components/ConsentScreen.tsx`
- `src/components/DiagnosisIntroScreen.tsx`
- `src/components/QuestionnaireScreen.tsx`
- `src/components/AnalyzingScreen.tsx`
- `src/components/ResultScreen.tsx`
- `src/components/CodePlanScreen.tsx`
- `src/components/CommonGuideScreen.tsx`
- `src/components/CodeDetailsScreen.tsx`
- `src/components/AuthScreen.tsx`
- `src/components/MembershipScreen.tsx`
- `src/components/CheckoutScreen.tsx`
- `src/components/MyPageScreen.tsx`

주요 로직:
- `src/App.tsx`: 화면 전환 및 bootstrap
- `src/api/questionnaire.ts`: 설문/결과 저장 및 조회
- `src/api/account.ts`: 인증/프로필/구독 조회
- `src/api/content.ts`: Supabase 콘텐츠/이미지 조회
- `src/utils/bodyCodeCalculator.ts`: 16가지 코드 계산
- `src/utils/characterImages.ts`: Supabase Storage 이미지 우선 로딩

## 현재 Supabase 사용 범위
현재 사용 중인 핵심 데이터:
- `questions`
- `questionnaire_responses`
- `body_code_content`
- `app_content`
- `app_images`
- `user_profiles`
- `membership_plans`
- `user_subscriptions`

이미지 규칙:
- 캐릭터 정본은 Supabase Storage 기준
- 캐릭터 경로: `images/characters/{BODY_CODE}.png`
- 16체형 이미지: `body-types/bodyTypesImage.png`

## 이미 구현된 핵심 사항
- 40문항 설문 DB 로드 및 저장
- 16가지 body code 계산
- 결과 페이지 UI 개편
- 결과 다음 장 `Code Plan` 분리
- `자세 사용 설명서`, `내 코드 더 알아보기` 별도 페이지 구성
- 결과 페이지 하단에 16체형 이미지 / 유튜브 / mock store 추가
- Supabase Storage 이미지 로딩 규칙 통일
- 로그인 사용자의 코드 플랜 풀스크린 모달 추가
- 마이페이지 기본 셸 추가
- 회원가입 / 로그인 연결
- 멤버십 / 체크아웃 UI 추가
- 비회원이면 항상 랜딩으로 시작하도록 bootstrap 수정

## 아직 남아 있는 큰 작업
1. 회원 데이터 보호용 RLS 재설계
2. 결과를 비회원 -> 회원 계정으로 귀속시키는 서버 API
3. 가상 결제를 서버 기반으로 변경
4. 실제 결제 연동 준비 구조(`payment_transactions` 등)
5. 심화 3문항 및 Ver3 확정 플로우
6. 마이페이지 결과 히스토리 확장
7. 인증 UX 보완(비밀번호 재설정, 이메일 인증 등)

## 문서 위치
핵심 문서:
- [TODO.md](./TODO.md)
- [docs/member-auth-billing-plan.md](./docs/member-auth-billing-plan.md)

Supabase 관련 문서:
- [supabase/auth_membership_and_revisit.sql](./supabase/auth_membership_and_revisit.sql)
- [supabase/ver3_advanced_tags.sql](./supabase/ver3_advanced_tags.sql)
- [supabase/app_content_and_images.sql](./supabase/app_content_and_images.sql)
- [supabase/questionnaire_responses_rls.sql](./supabase/questionnaire_responses_rls.sql)
- [supabase/연동_검증_체크리스트.md](./supabase/연동_검증_체크리스트.md)

새 컴퓨터에서 바로 이어받으려면 아래 문서를 먼저 보면 됩니다.
- [docs/project-handoff-2026-04-15.md](./docs/project-handoff-2026-04-15.md)

## 새 컴퓨터에서 최소 체크
1. repo clone
2. `npm install`
3. `.env` 복원
4. `npm run dev`
5. Supabase 연결 확인
6. `npm run build`
7. Vercel 환경변수 확인

## 참고
- 현재 체크아웃은 실제 결제가 아니라 테스트/가상 결제 단계입니다.
- 현재 공유 결과 URL 정책은 회원 데이터 보안 구조를 다시 잡으면서 재설계할 가능성이 큽니다.
- 현재 목표는 “디자인 정리 완료 후, 회원/결제/보안 구조를 안정화하는 것”입니다.
