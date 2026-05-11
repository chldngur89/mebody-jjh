# MEBODY Mobile Service

MEBODY 모바일 서비스는 사전체크 4개와 본문 49개, 총 53문항으로 현재 몸의 정렬 패턴을 기록하고 4축 기반 mebody 코드와 코드 플랜을 제공하는 고객용 웹앱입니다.

- 로컬 앱: http://localhost:3000
- 배포 앱: https://mebody-jjh.vercel.app/
- 정상 진단, 문항, 계산, 결과 표시는 Supabase와 클라이언트 계산 로직만 사용합니다.
- Railway/Spring 서버가 꺼져 있어도 고객 진단과 결과 제공은 막히면 안 됩니다.

웹 홈페이지와 관리자 화면은 이 앱이 아니라 `../Server`에서 제공합니다.

## Repositories

- Mobile (this repo): https://github.com/chldngur89/mebody-jjh
- Server (Spring Boot): https://github.com/chldngur89/mebody-server

## Stack

- React 18
- TypeScript
- Vite 6
- Supabase JS Client
- lucide-react
- Vercel 배포

## Product Flow

- 랜딩
- 안내 및 동의
- 측정 기준 안내
- 53문항 설문: 사전체크 4개 + 본문 49개
- 분석 중 화면
- 무료 결과 페이지
- 코드 플랜 / 오늘의 미션
- 자세 사용 설명서
- 내 코드 더 알아보기
- 회원가입 / 로그인
- 마이페이지
- 멤버십 / 체크아웃 mock

## Runtime Rules

- 첫 문항은 번들된 53문항 스냅샷으로 즉시 표시합니다.
- Supabase `questions`는 백그라운드로 갱신합니다.
- Supabase 문항 응답이 53개 미만이거나 `A-1`, `B-1`, `49`가 없으면 캐시하지 않습니다.
- 53문항 완료 후 즉시 `analyzing` 화면으로 이동합니다.
- 결과 코드는 클라이언트에서 즉시 계산합니다.
- Supabase 저장이 실패해도 고객은 로컬 결과 화면을 봅니다.
- 로그인 사용자의 최신 코드 정본은 `questionnaire_responses`의 최신 `completed` 결과입니다.
- `user_profiles.body_bti_code`는 빠른 표시용 캐시이며 제출 성공 시 최신 코드로 갱신합니다.

## Environment Variables

`.env` 또는 Vercel Environment Variables에 설정합니다.

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# 선택값: 모바일 마이페이지에서 서버 관리자 버튼/서버 프로필 동기화에만 사용합니다.
# 이 값이 없어도 진단, 문항, 결과, 코드 플랜은 동작해야 합니다.
VITE_API_BASE_URL=https://mebody-server-production.up.railway.app
```

로컬에서 서버와 같이 테스트할 때만 `VITE_API_BASE_URL=http://localhost:8080`으로 바꿉니다.

## Run

```bash
npm install
npm run dev
```

접속: http://localhost:3000

## Build

```bash
npm run build
git diff --check
```

## Supabase Tables Used

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

## Storage Rules

Supabase Storage bucket: `images`

- 캐릭터: `characters/{BODY_CODE}.png`
- 축 아이콘: `axis/axis-neck.png`
- 축 아이콘: `axis/axis-shoulder.png`
- 축 아이콘: `axis/axis-pelvis.png`
- 축 아이콘: `axis/axis-flexibility.png`
- 16가지 체형 이미지: `body-types/bodyTypesImage.png`

캐릭터 이미지는 Storage를 우선 사용하고, 실패하면 `app_images`, 마지막으로 로컬 fallback을 사용합니다.

## Result Memory Policy

- 비회원: 현재 탭 `sessionStorage`에만 결과 id를 보관합니다.
- 비회원: 새 탭, 새 브라우저, 공유 URL 단독 진입은 랜딩으로 보냅니다.
- 로그인 사용자: `questionnaire_responses.user_id` 기준 최신 완료 결과를 불러옵니다.
- Supabase Auth 세션 저장은 유지합니다.

## Important Files

- `src/App.tsx`: 화면 전환, 결과 저장 상태, 로그인 후 분기
- `src/api/questionnaire.ts`: 문항 조회, 53문항 검증, 응답 저장, 결과 조회
- `src/api/account.ts`: 프로필, 최신 결과, 멤버십 조회
- `src/api/content.ts`: 콘텐츠, 이미지, Ver6 액션 데이터 조회
- `src/utils/bodyCodeCalculator.ts`: 53문항 기반 4축 mebody 코드 계산
- `src/data/ver3QuestionsSnapshot.ts`: 즉시 렌더링용 53문항 스냅샷
- `src/utils/characterImages.ts`: Supabase Storage 우선 캐릭터 이미지 해석

## Verification Checklist

- 서버를 끄고도 첫 문항이 빠르게 표시되는지 확인합니다.
- Supabase active questions가 `total=53`, `precheck=4`, `scored=49`인지 확인합니다.
- 53문항 완료 후 바로 분석 화면으로 이동하는지 확인합니다.
- 저장 실패 상황에서도 결과 화면이 막히지 않는지 확인합니다.
- 같은 회원이 다시 진단하면 랜딩, 마이페이지, 코드플랜, 관리자 모두 마지막 완료 코드 기준으로 표시되는지 확인합니다.
- 앱 문구에서 과거 문항수 표현이 노출되지 않는지 확인합니다.
