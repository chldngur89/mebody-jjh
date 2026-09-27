# MEBODY 배포 서비스 UX·연동 감사

- 조사일: 2026-09-22 (KST)
- 앱: https://mebody-jjh.vercel.app
- 홈페이지·API: https://mebodyserver-production.up.railway.app
- 앱 저장소: `b22404c`
- 서버 저장소: `ebe9022`
- 판정: **NO-GO — 공개 사용자 모집 전 P0 수정과 재배포 필요**

## 1. 결론

비회원의 `랜딩 → 동의 → 안내 → 첫 문항` 이동과 내부·브라우저 뒤로가기는 실제 모바일 크기 브라우저에서 정상 동작했다. DB에도 32개 활성 문항, 동의 시각 컬럼, 분석 이벤트 테이블, 계정 탈퇴 함수가 적용되어 있고 관련 정적·트랜잭션 검증도 통과했다.

그러나 현재 Vercel 앱은 사용자가 안내한 Railway API가 아닌 `https://mebody-server.vercel.app/`을 서버 주소로 포함한다. 이 주소는 정적 홈페이지이며 인증·계정·결제 API가 404다. 따라서 휴대폰 가입·로그인·복구, 회원 탈퇴, 결제·주문, 전문가 초대 등 서버 의존 기능은 배포 화면에서 완주할 수 없다. 법적 문서에는 운영자 연락처 플레이스홀더가 남아 있고, 실제 인증 설정과 홈페이지 안내도 서로 다르다.

무료 비회원 진단만 제한적으로 공개할 수는 있으나, 회원 기능·마이페이지·결제까지 제공하는 현재 표현으로 공개 출시하면 안 된다.

## 2. 출시 차단 항목

| 우선순위 | 발견 | 사용자 영향 | 증거 등급 | 조치 |
|---|---|---|---|---|
| P0 | 배포 앱 API 주소가 잘못됨 | 가입·휴대폰 로그인·복구·탈퇴·결제·주문·전문가 기능 실패 | REPRODUCED + CODE_VERIFIED | Vercel `VITE_API_BASE_URL`을 `https://mebodyserver-production.up.railway.app`으로 바꾸고 재배포. 배포 후 주요 API 스모크 테스트를 필수 게이트로 추가 |
| P0 | 개인정보처리방침·약관에 `[주소]`, `[문의 이메일]`, `[전화번호]`, 개인정보 보호책임자 플레이스홀더가 남음 | 신뢰 저하, 문의·권리행사 경로 부재, 유료 서비스 공개 위험 | PRODUCTION_OBSERVED | 실제 운영자 정보로 앱·서버 두 문서를 함께 교체 |
| P0 | 이메일·휴대폰 소유 확인이 모두 꺼져 있고 서버 최소 비밀번호가 1자로 설정됨 | 타인의 이메일·번호 선점, 계정 복구·소유권 분쟁, 약한 암호 안내 | PRODUCTION_OBSERVED + CODE_VERIFIED | 이메일 확인을 켜고 휴대폰은 SMS 인증 전까지 가입 수단에서 숨김. 앱과 서버에서 동일한 최소 8자 정책과 안내 적용 |
| P0 | 실제 인증 설정과 홈페이지 안내가 반대임 | 홈페이지는 확인 메일을 기다리게 하지만 실제 설정은 즉시 가입. 사용자가 가입 상태를 오해함 | REPRODUCED | `/api/public/auth/config` 결과로 안내를 동적으로 표시하거나 배포 설정과 정적 문구를 한 번에 검증 |
| P1 | 동의 증적에 시각만 있고 약관 버전·채널이 없음. 비회원 진단 동의도 서버 증적이 확인되지 않음 | 어떤 문서에 어느 화면에서 동의했는지 입증하기 어려움 | SCHEMA_VERIFIED + CODE_VERIFIED | `consent_type`, `policy_version`, `agreed_at`, `channel`, `user/session`을 가진 append-only 동의 원장 추가 |

## 3. 상세 발견

### P0-1. 앱과 서버가 실제로 연결되지 않았다

재현:

1. 배포 앱의 메인 JS 번들을 확인했다.
2. 번들에 `VITE_API_BASE_URL:"https://mebody-server.vercel.app/"`이 포함되어 있었다.
3. 해당 주소의 `/api/public/auth/signup`, `/health`, `/api/public/auth/config`는 404였다.
4. 실제 Railway 주소 `https://mebodyserver-production.up.railway.app/health`는 200이고, 앱 Origin에 대한 CORS preflight도 통과했다.

주소가 세 가지로 갈라져 있다.

- 배포 앱 번들: `https://mebody-server.vercel.app/`
- 저장소 `.env`·`.env.example`: `https://mebody-server-production.up.railway.app`
- 실제 동작 서버: `https://mebodyserver-production.up.railway.app`

앱은 API 주소가 존재하는 한 HTTP 404를 네트워크 장애로 보지 않고 즉시 오류 처리한다. 따라서 이메일 가입도 Supabase 폴백으로 가지 않는다. 관련 구현은 [signup.ts](/Users/wh.choi/Desktop/mebody/mebody-jjh/src/api/signup.ts:17), [accountDeletion.ts](/Users/wh.choi/Desktop/mebody/mebody-jjh/src/api/accountDeletion.ts:12), 잘못된 예시는 [.env.example](/Users/wh.choi/Desktop/mebody/mebody-jjh/.env.example:9)이다.

개선:

- Vercel Production 환경 변수를 실제 Railway 주소로 수정하고 새 배포를 만든다.
- `env:check`가 단순히 HTTPS 여부만 보지 않고 `${API_BASE}/health` 200과 `${API_BASE}/api/public/auth/config`의 예상 JSON을 확인하게 한다.
- 배포 CI에서 앱 번들의 API host가 허용 목록과 정확히 같은지 검사한다.
- 수정 후 이메일·휴대폰 가입, 복구, 마이페이지 탈퇴, 멤버십 조회를 테스트 계정으로 다시 완주한다.

### P0-2. 법적 문서는 서로 같지만 최종 문서가 아니다

앱 `/privacy.html`과 서버 `/privacy`, 앱 `/terms.html`과 서버 `/terms`의 본문은 각각 완전히 동일했다. 문구 통일 자체는 통과다.

하지만 양쪽 모두 다음 값이 그대로 노출된다.

- 사업자등록 준비 중
- `[주소]`
- `[성명 / 직책]`
- `[문의 이메일]`
- `[전화번호]`

홈페이지에는 `mebody@mebody.net`이 이미 표시되므로 최소한 문의 이메일부터 문서에 반영할 수 있다. 위치는 앱 [privacy.html](/Users/wh.choi/Desktop/mebody/mebody-jjh/public/privacy.html:154), [terms.html](/Users/wh.choi/Desktop/mebody/mebody-jjh/public/terms.html:154), 서버 [privacy.html](/Users/wh.choi/Desktop/mebody/mebody-server/src/main/resources/static/privacy.html:148), [terms.html](/Users/wh.choi/Desktop/mebody/mebody-server/src/main/resources/static/terms.html:149)이다.

### P0-3. 계정 소유 확인과 비밀번호 정책이 출시 수준이 아니다

배포 서버 `/api/public/auth/config` 실측:

- `emailVerificationRequired: false`
- `phoneVerificationRequired: false`
- `phoneMode: alias`
- `minPasswordLength: 1`

앱 가입 화면도 “확인 절차 없이 바로 가입됩니다”라고 표시한다. 서버 코드 역시 1자 하한을 사용한다([PublicAuthService.java](/Users/wh.choi/Desktop/mebody/mebody-server/src/main/java/com/mebody/auth/service/PublicAuthService.java:74)). 휴대폰 번호는 실제 SMS 소유 확인이 아니라 별칭 이메일 방식이다.

최소 조치:

- 이메일 인증을 켜고 재전송·만료·복귀 흐름을 실제 메일로 확인한다.
- SMS 공급자가 없으면 휴대폰 가입을 UI에서 숨기고 이메일만 제공한다.
- 서버와 앱 모두 8자 이상 정책을 먼저 안내하고 같은 오류 문구를 사용한다.
- 복구 수단이 없는 휴대폰 계정 생성을 허용하지 않는다.

### P0-4. 홈페이지 회원가입 안내가 실제 설정·폼과 맞지 않는다

홈페이지 가입 폼은 “가입하면 확인 메일이 갑니다”라고 안내하지만 서버 설정은 이메일 확인을 끈 상태다. 같은 문단은 “휴대폰 번호로 가입하면 바로 이용”이라고 하지만 홈페이지 입력칸은 `type=email` 하나뿐이라 휴대폰 가입 수단이 없다([index.html](/Users/wh.choi/Desktop/mebody/mebody-server/src/main/resources/static/index.html:273)). 로그인 상태에서도 비밀번호 placeholder가 “원하는 비밀번호”라 새 비밀번호를 만드는 칸처럼 보인다.

개선:

- 가입 설정을 `/api/public/auth/config`에서 읽어 안내 문구를 동적으로 만든다.
- 홈페이지가 이메일 전용이면 휴대폰 문구를 제거한다.
- 로그인 placeholder는 “비밀번호 입력”, 가입은 “8자 이상 비밀번호”로 분리한다.

### P1-1. 동의는 저장되지만 증적이 충분하지 않다

현재 적용 DB에는 다음 컬럼이 있다.

- `terms_agreed_at`
- `privacy_agreed_at`
- `marketing_agreed_at`
- `marketing_opt_in`

앱과 홈페이지 가입 요청은 약관·개인정보 동의 Boolean을 서버로 보내고 서버가 시각을 기록한다([web.js](/Users/wh.choi/Desktop/mebody/mebody-server/src/main/resources/static/assets/web.js:308), [PublicAuthService.java](/Users/wh.choi/Desktop/mebody/mebody-server/src/main/java/com/mebody/auth/service/PublicAuthService.java:261)). 다만 정책 버전, 가입 채널, 표시 문구, 철회 시각이 없다. 비회원이 32문항 전에 누르는 의료 비진단·법적 동의는 별도의 서버 원장으로 저장되는 경로가 확인되지 않았다.

가입 프로필 컬럼을 계속 덧붙이기보다 별도 `user_consents` 원장을 두고 다음을 저장하는 편이 안전하다.

`consent_type`, `policy_version`, `agreed_at`, `revoked_at`, `channel(web/app)`, `user_id` 또는 익명 세션 키.

### P1-2. 분석 이벤트가 동의 선택 전에 전송된다

앱은 첫 렌더에서 `landing_viewed`를 전송하고 `track()`은 쿠키 동의 상태를 확인하지 않는다. 배너는 광고 개인화만 제어한다([analytics.ts](/Users/wh.choi/Desktop/mebody/mebody-jjh/src/lib/analytics.ts:100)). 이벤트에는 사용자 ID·이메일·원문 답변이 없고, DB RLS와 60건 제한은 검증을 통과했다. 데이터 최소화는 잘 되어 있다.

개선:

- 필수 서비스 분석이라면 배너와 개인정보 문서에 목적·보관기간·거부 영향을 명확히 쓴다.
- 동의 기반 분석이라면 `accepted` 이후에만 큐를 전송하고 `필수만`에서는 보내지 않는다.
- 현재 “광고 목적 쿠키”만 설명하는 배너와 실제 분석 수집 범위를 일치시킨다.

### P1-3. 로그인 화면 문구가 진입 목적과 무관하게 결과 저장을 말한다

랜딩 상단의 로그인 버튼으로 들어가도 “결과 저장을 위해 가입하기”, “로그인하고 저장”이 표시된다. 아직 결과가 없는 사용자에게는 무엇을 저장하는지 알 수 없다. 원인은 기본 인증 목적에도 결과 저장 문구를 사용하는 조건이다([AuthScreen.tsx](/Users/wh.choi/Desktop/mebody/mebody-jjh/src/components/AuthScreen.tsx:326)).

개선:

- 일반 진입: “로그인 또는 회원가입” / “로그인”
- 결과 직후: “결과를 계정에 저장” / “가입하고 결과 저장”
- 멤버십 진입: “로그인 후 멤버십 보기”

### P1-4. “약 3분” 약속이 32개 동작형 문항과 맞지 않는다

홈페이지는 32문항을 “소요 약 3분”이라고 안내한다. 현재 문항에는 의자에서 10회 일어나기, 10초 유지, 양쪽 움직임 확인처럼 수행 시간이 필요한 항목이 포함되어 있다. 3분이면 설명 읽기와 선택을 포함해 문항당 평균 5.6초라 실제 사용자가 약속을 지키기 어렵다.

실사용 10명 이상에서 중앙값·90백분위 시간을 측정해 “약 N~M분”으로 바꾸고, 시작 전에 동작 공간·의자 필요 여부도 알려야 한다.

### P1-5. 다운로드 CTA가 실제 다운로드로 이어지지 않는다

홈페이지 상단의 “앱 다운로드”는 다운로드 영역으로 이동하지만 App Store는 “출시 준비 중”, Google Play는 “곧 공개”이며 스토어 링크가 없다. 공개 홈페이지에서는 버튼을 “앱 출시 알림” 또는 “웹에서 시작”으로 바꾸는 편이 기대와 맞다.

### P2-1. 큰 원본 이미지가 모바일 데이터와 메모리에 부담을 줄 수 있다

저장소의 축 이미지 중 `axis-flexibility.png`는 약 5.7MB, `axis-neck.png`는 약 4.6MB, `axis-shoulder.png`는 약 1.2MB다. 결과 화면에서 쓰이는 자산이라 초기 랜딩을 막지는 않지만 저속 네트워크·저사양 Android에서 결과 진입 지연과 메모리 압박이 생길 수 있다.

표시 크기에 맞춘 WebP/AVIF 파생본과 `srcset`을 사용하고, 결과 직전 프리로드 여부를 실제 네트워크로 측정한다.

### P2-2. 설치형처럼 보이지만 오프라인 복구는 없다

`manifest.json`과 아이콘은 있어 홈 화면 설치는 가능하지만 `sw.js`는 활성화 시 캐시를 모두 지우고 자신을 해제한다([sw.js](/Users/wh.choi/Desktop/mebody/mebody-jjh/public/sw.js:1)). 네트워크가 끊기면 재실행·진행 복구를 보장하지 않는다. 오프라인 지원을 약속하지 않는다면 문구로 제한을 알리고, 지원할 계획이면 앱 셸과 진행 초안을 안전하게 캐시한다.

### P3. 작은 문구·운영 정합성 문제

- 앱·서버 README와 환경 예시에 이미 폐기된 Railway 주소가 남아 재발 가능성이 높다.
- 홈페이지 로그인 폼의 “이름 또는 닉네임” 라벨은 필드가 숨겨진 로그인 모드에서도 접근성 트리에 잠깐 혼동을 줄 수 있다.
- 앱 회원가입의 두 번째 체크박스가 개인정보와 이용약관을 한 번에 묶는다. 문서별 동의 증적이 필요하면 별도 체크박스로 나누는 편이 명확하다.
- 안내 화면에서 동의 화면으로 돌아오면 체크 상태가 초기화된다. 법적으로 보수적인 동작이지만 사용자는 반복 입력으로 느낄 수 있다.

## 4. 뒤로가기·이동 검증표

| 진입·동작 | 기대 | 결과 | 증거 |
|---|---|---|---|
| 랜딩 → 로그인 → 화면 내 `뒤로` | 랜딩 복귀 | 통과 | REPRODUCED |
| 랜딩 → 동의 → 화면 내 `뒤로` | 랜딩 복귀 | 코드·동작 통과 | REPRODUCED |
| 동의 → 안내 → 화면 내 `뒤로` | 동의 복귀 | 통과. 체크 상태는 초기화 | REPRODUCED |
| 안내 → 첫 문항 → `이전` | 안내 복귀 | 통과 | REPRODUCED |
| 안내에서 브라우저 뒤로가기 | 동의 복귀 | 통과 | REPRODUCED |
| 동의에서 브라우저 앞으로가기 | 안내 복귀 | 통과 | REPRODUCED |
| 가입 중 개인정보·약관 열기 | 가입 상태를 잃지 않고 문서 확인 | 새 탭으로 열림 | REPRODUCED + CODE_VERIFIED |
| 문항별 브라우저 뒤로가기·답변/현재 문항 복구 | 직전 문항과 선택 복구 | 로직 검증 통과, 운영 데이터 생성 없이 전체 32문항 실재현은 생략 | CODE_VERIFIED |
| 결과 완료 후 뒤로가기 | 32개 문항을 역순으로 모두 거치지 않고 진입 부모로 복귀 | 자동검증 통과 | CODE_VERIFIED |
| 홈·내 상태·미션·루틴·마켓 탭 | 선택 탭과 상태 유지 | 배포 로그인 세션이 없어 실제 재현 불가 | UNVERIFIED |
| 마이페이지 → 회원 탈퇴 | 확인 후 계정·개인 데이터 삭제, 거래 기록 익명 보존 | DB 함수·권한·롤백 테스트 통과. 배포 앱 API 주소 오류로 UI 완주 실패 | SCHEMA_VERIFIED + CODE_VERIFIED, 배포 UNVERIFIED |
| 멤버십 → 체크아웃 → 취소/뒤로 | 원래 진입 화면 복귀 | 배포 앱 API 주소 오류와 테스트 결제 금지로 확인 불가 | UNVERIFIED |
| Android 하드웨어 뒤로가기 | 웹 히스토리와 동일하게 복귀 | 실제 APK/기기 미확인 | UNVERIFIED |

공개 진단 구간의 뒤로가기는 이전 감사보다 안정적이다. `useFlowHistory`가 화면·탭·문항·결과 ID를 history state에 넣고 중복 클릭을 막는다([useFlowHistory.ts](/Users/wh.choi/Desktop/mebody/mebody-jjh/src/utils/useFlowHistory.ts:23)). 자동 검증 29건도 모두 통과했다. “전체가 잘 된다”는 판정은 로그인 이후 실제 세션과 Android 기기 검증 전에는 할 수 없다.

## 5. 앱·서버 문구와 상태 일치표

| 항목 | 앱 | 홈페이지·서버 | 판정 |
|---|---|---|---|
| 문항 수 | 32 | 32 | 통과 |
| 축 | 목·어깨·골반·하체 4축 | 동일 | 통과 |
| 의료 표현 | 의료 진단 아님, 통증 시 전문가 우선 | 동일 | 통과 |
| 개인정보처리방침 본문 | 서버 본문과 동일 | 앱 본문과 동일 | 통과, 플레이스홀더 때문에 최종본 아님 |
| 이용약관 본문 | 서버 본문과 동일 | 앱 본문과 동일 | 통과, 플레이스홀더 때문에 최종본 아님 |
| 이메일 확인 | 확인 없이 즉시 가입 안내 | 확인 메일 발송 안내, 실제 설정 OFF | 실패 |
| 휴대폰 가입 | 제공 | 홈페이지는 문구만 있고 이메일 입력만 제공 | 실패 |
| 비밀번호 정책 | 사전 길이 안내 없음 | 서버 설정 1자, 실제 인증 공급자 제한과 불일치 가능 | 실패 |
| 동의 저장 | 앱 요청은 Boolean 전송 | 서버가 시각 저장 | 부분 통과. 버전·채널 없음 |
| 회원 탈퇴 | 마이페이지 버튼·API 호출 구현 | 인증 API·DB 함수 구현 | 코드 통과, 배포 연결 실패 |
| 15분 루틴 | 구현·규칙 테스트 통과 | 홈페이지 15분 안내 | 통과 |
| 앱 다운로드 | 앱 내부 해당 없음 | 스토어 출시 예정만 표시 | 기대 불일치 |

## 6. 통과한 기술 검증

- 앱 production build 성공
- TypeScript 오류 0건
- 화면 이동·진행 복구·저장 timeout 29건 통과
- 저니 규칙 112건 통과
- 서버 Maven 테스트 통과
- 분석 이벤트 스키마·RLS·rate limit 12건 통과 (`BEGIN/ROLLBACK`)
- 계정 탈퇴 데이터 삭제·거래 기록 익명 보존·권한 24건 통과 (`BEGIN/ROLLBACK`)
- 현재 DB: 활성 문항 32/32, `questionnaire_responses`, `user_journeys`, `analytics_events`, `prepare_account_deletion()` 적용 확인
- 실제 Railway API는 앱 Origin CORS preflight 통과
- 앱·서버 법적 문서 본문 텍스트 정규화 비교 결과 동일

## 7. 재출시 전 권장 순서

1. Vercel API base를 실제 Railway 주소로 교체하고 재배포한다.
2. 이메일 확인·비밀번호 정책을 확정하고 앱·홈페이지 문구를 동일하게 바꾼다.
3. 법적 문서의 운영자·문의 정보를 완성한다.
4. 동의 원장에 버전·채널을 추가하고 비회원 진단 동의 저장 여부를 결정한다.
5. 안전한 테스트 계정으로 `가입 → 32문항 → 결과 저장 → 홈/내 상태/미션/루틴/마켓 → 로그아웃/재로그인 → 탈퇴`를 배포 환경에서 완주한다.
6. Android APK에서 시스템 뒤로가기, 앱 종료·재실행, 네트워크 끊김, 딥링크 복귀를 확인한다.
7. 결제·광고는 위 단계가 끝날 때까지 사용자에게 숨긴다.

## 8. 검증 제한

- 운영 계정·주문·결제를 만들지 않았다.
- 실제 이메일·SMS 인증, 결제 승인, 탈퇴 API의 운영 호출은 하지 않았다.
- 마이페이지 이후 화면은 테스트 계정이 없고 배포 앱의 API 연결이 끊겨 실제 실행 대신 코드·DB·롤백 테스트로 확인했다.
- 실제 Android 기기와 APK는 이번 배포 URL 감사 범위에서 실행하지 못했다.
