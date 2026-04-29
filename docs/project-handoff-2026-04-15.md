# MEBODY 인수인계 문서

작성일: 2026-04-15

## 이 문서의 목적
컴퓨터를 바꾼 뒤에도 바로 프로젝트를 이어서 작업할 수 있도록 현재 상태, 우선순위, 필요한 설정을 정리합니다.

## 지금까지 해낸 것
### UI / UX
- 랜딩 화면을 현재 민트 계열 톤으로 재정리
- 로그인 화면 디자인 정리
- 결과 페이지를 새 구조로 개편
- 결과 이후 페이지를 분리
  - 코드 플랜
  - 자세 사용 설명서
  - 내 코드 더 알아보기
- 마이페이지 기본 셸 구현
- 멤버십 / 체크아웃 UI 구현
- 결과 페이지 하단에 아래 섹션 추가
  - 16가지 체형 이미지
  - 추천 유튜브 2개
  - mock store

### 데이터 / 연동
- 질문은 Supabase `questions`에서 로드
- 결과는 `questionnaire_responses`에 저장
- body code 콘텐츠는 `body_code_content` 사용
- 앱 문구/이미지는 `app_content`, `app_images` 사용
- 캐릭터 이미지는 Supabase Storage 우선 로딩으로 통일
- 회원가입 / 로그인은 Supabase Auth 연결
- `user_profiles`, `membership_plans`, `user_subscriptions` 사용 시작

### 동작 정책
- 비회원이면 앱 첫 진입 시 무조건 랜딩으로 시작
- 로그인 사용자만 최근 결과 재방문 기능 사용
- 결과 페이지에서 코드 플랜으로 이어지는 흐름 존재

## 새 컴퓨터에서 해야 할 기본 세팅
### 1. 소스 받기
```bash
git clone <repo-url>
cd mebody
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경변수 복원
`.env` 또는 `.env.production`에 아래 2개를 넣어야 함.

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### 4. 실행 확인
```bash
npm run dev
npm run build
```

확인 포인트:
- 랜딩 진입 정상
- 40문항 로드 정상
- 결과 페이지 로드 정상
- 이미지 정상
- 로그인 화면 정상

## 현재 가장 중요한 다음 작업
### 1. 회원 데이터 보호 구조
우선순위 가장 높음.

필요한 작업:
- `questionnaire_responses` RLS 재설계
- 비회원 결과를 회원 계정으로 귀속하는 서버 API 추가
- 공개 결과 접근 정책 재검토

관련 문서:
- [member-auth-billing-plan.md](./member-auth-billing-plan.md)
- [../supabase/questionnaire_responses_rls.sql](../supabase/questionnaire_responses_rls.sql)

### 2. 가상 결제 서버화
현재는 프론트가 DB 상태를 직접 바꾸는 테스트 구조라 위험함.

필요한 작업:
- `payment_transactions` 구조 추가
- Vercel API로 결제 요청/확정 처리
- `activateSubscription()` 직접 호출 제거

### 3. Ver3 심화 플로우
이미 감지 로직/미리보기 일부는 들어가 있음.

남은 작업:
- 심화 3문항 실제 화면
- 저장 연결
- 확정 태그 결과 페이지
- low confidence 예외 플로우

## 추천 작업 순서
1. 회원 데이터 / 결제 구조 SQL 설계
2. Vercel API 추가
3. Auth / Checkout 프론트 연결
4. RLS 검증
5. Ver3 심화 플로우 구현
6. 마이페이지 결과 히스토리 확장

## 지금 손대면 안 되는 것
- UI를 다시 크게 갈아엎는 것
- 실제 결제사 연동을 성급하게 붙이는 것
- 개인정보 컬럼을 과하게 늘리는 것

이유:
- 현재 디자인 방향은 꽤 정리된 상태라, 이제는 구조 안정화가 우선임
- 결제사는 아직 법인/운영 조건이 없으므로 가상 결제 + 실결제 준비형 구조가 맞음
- 개인정보는 최소 수집 원칙 유지가 안전함

## 꼭 기억할 현재 이슈
1. 체크아웃은 아직 진짜 결제가 아님
2. `questionnaire_responses` 공개 접근 정책은 다시 잡아야 함
3. PWA 캐시 때문에 배포 후 이전 화면이 보일 수 있음
4. 이미지 정본은 Supabase Storage 기준임
5. 비회원은 결과 자동 진입을 하지 않도록 최근 수정됨

## 자주 보는 파일
- `src/App.tsx`
- `src/api/questionnaire.ts`
- `src/api/account.ts`
- `src/components/ResultScreen.tsx`
- `src/components/CodePlanScreen.tsx`
- `src/components/codePlanShared.tsx`
- `supabase/auth_membership_and_revisit.sql`
- `supabase/ver3_advanced_tags.sql`
- `TODO.md`

## 바로 시작할 때 체크리스트
- [ ] `.env` 복원
- [ ] `npm install`
- [ ] `npm run dev`
- [ ] `npm run build`
- [ ] Supabase 데이터 확인
- [ ] 현재 Vercel 환경변수 확인
- [ ] 회원/결제 구조 문서 다시 읽기
- [ ] SQL 초안부터 시작
