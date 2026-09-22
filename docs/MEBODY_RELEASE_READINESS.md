# MEBODY 국내 Android 베타 출시 준비도

감사일: 2026-09-19  
판정 대상: `mebody-jjh` `main` HEAD `6d71190` + 미커밋 변경, `mebody-server` `main` HEAD `7bb8240` + 미커밋 변경, 현재 연결된 Supabase, 공개 Vercel URL  
판정: **NO-GO**

## 판정 이유

핵심 진단과 개인화 규칙은 상당히 완성되어 있다. 웹 빌드와 타입 검사, 이동·복구 단위 검증 29건, 개인화 규칙 112건은 모두 통과했다. 현재 DB에도 32개 활성 문항, Journey·결과·주문 관련 테이블, RLS, 결과 조회/저장 RPC가 적용되어 있다.

그러나 외부 베타 사용자에게 계정을 열 수 있는 상태는 아니다. 운영 URL의 개인정보처리방침과 이용약관이 스스로 플레이스홀더라고 밝히고 있으며, 필수 동의를 받지만 동의 종류·문서 버전·시각·채널 증적을 저장하지 않는다. 계정 삭제는 DB 준비 함수만 있고 앱과 회원 API가 없다. 배포 앱에는 Spring API 주소가 들어 있지 않고 기록된 Railway 주소도 404 `Application not found`라 휴대폰 가입·결제·주문·광고 검증 경로를 쓸 수 없다. 통증·어지럼으로 동작을 중단한 사용자가 선택할 안전 응답도 없다. 이 항목들은 본 감사의 NO-GO 기준에 직접 해당한다.

## 출시 차단 항목

| ID | 심각도 | 발견 | 증거 | 차단 | 최소 해제 조건 |
|---|---|---|---|---|---|
| RR-01 | P0 | 배포된 개인정보처리방침과 이용약관이 플레이스홀더이며 실제 수집 항목·보유기간·책임자·유료 정책이 확정되지 않음 | `PRODUCTION_OBSERVED`, `CODE_VERIFIED` | 예 | 실제 운영 내용을 반영한 최종 문서, 시행일·버전·사업자/문의·국외 이전/위탁·광고 SDK·삭제 절차 반영 |
| RR-02 | P0 | 필수 동의가 UI 체크로만 끝나며 서버/DB에 종류·버전·동의 시각·채널이 없음 | `SCHEMA_VERIFIED`, `CODE_VERIFIED` | 예 | append-only 동의 증적 저장과 철회/재동의 정책, 가입·진단 양쪽 연결 |
| RR-04 | P0 | 회원 탈퇴는 `prepare_account_deletion()`만 DB에 적용됐고 앱 버튼과 인증된 서버 삭제 API가 없음 | `SCHEMA_VERIFIED`, `CODE_VERIFIED` | 예 | 재인증·확인·거래기록 보존을 포함한 종단 간 삭제와 외부 삭제 요청 경로 |
| RR-05 | P0 | 공개 서버 주소가 전 경로에서 404이고 배포 앱 번들에 API base가 없음. 휴대폰 가입·결제·주문·SSV가 끊김 | `PRODUCTION_OBSERVED` | 예 | 고정 운영 API 배포, CORS/health/auth/billing 확인, 앱 release 환경 주입 |
| RR-06 | P0 | 로컬 Android 빌드 환경의 API base가 `localhost:8081`; 현 상태로 APK를 만들면 기기에서 서버 기능에 연결할 수 없음 | `CODE_VERIFIED` | 예 | release 전용 환경과 CI secret/variant, 산출 APK의 실제 base URL 검증 |
| RR-07 | P0 | 핵심 퍼널 이벤트가 수집처로 전송되지 않음. `track()`은 개발 콘솔 출력만 수행 | `CODE_VERIFIED` | 예 | 동의 이후 실제 수집, 중복 방지, 세션/유입 연결, 운영 대시보드 |
| RR-08 | P1 | 이메일·휴대폰 소유 확인이 서버 기본 설정에서 꺼져 있고 휴대폰 alias는 복구 불가. 서버의 공개 approve 경로는 확인 대기 계정을 식별자만으로 승인 | `CODE_VERIFIED`; 배포 서버 `UNVERIFIED` | 예 | 이메일 확인, SMS 또는 휴대폰 가입 중단, 복구 가능성, 승인 우회 제거 |
| RR-09 | P1 | 체크아웃은 Play Billing 구매가 아니라 날짜 기반 임시 token을 서버 verify에 보냄. 실 Google provider에서는 정상 구매 증명이 될 수 없음 | `CODE_VERIFIED` | 예(결제를 노출하면) | 결제/광고를 베타에서 숨기거나 Play Billing 종단 간 샌드박스 검증 |
| RR-10 | P1 | AdMob 단위가 비어 테스트 광고가 표시되고 SSV는 서버 미연결 시 꺼짐 | `CODE_VERIFIED` | 예(광고를 노출하면) | 베타에서 광고·보상 비활성화 또는 release 광고/동의/SSV 검증 |
| RR-11 | P1 | Android 시스템 뒤로가기·프로세스 종료·오프라인 재실행을 실제 APK/기기에서 검증하지 못함 | `UNVERIFIED` | 조건부 | 최소 2개 Android 버전/기기에서 시나리오 매트릭스 통과 |

## 해제 현황 — 2026-09-21 갱신

위 표는 2026-09-19 시점의 감사 기록이다. 그 뒤 작업으로 아래가 바뀌었다.

| ID | 상태 | 근거 |
|---|---|---|
| RR-01 | 해제 | 양 repo `terms.html`·`privacy.html` 본문 교체. 시행일 2026-07-22. 빈칸 4개(주소·문의 이메일·전화·개인정보 보호책임자)는 사업자 등록 후 채운다 |
| RR-02 | 해제 | `055_signup_consent.sql` — `user_profiles` 에 `terms_agreed_at`·`privacy_agreed_at`·`marketing_agreed_at`. 서버가 가입 시 기록 |
| RR-04 | 해제 | `046_delete_account.sql` + `DELETE /api/account` + 마이페이지 탈퇴 버튼. 검증 41건 |
| RR-05 | 배포 대기 | 서버 코드는 정상이고 로컬에서 200 을 낸다. Railway 호스트는 `{"code":404,"message":"Application not found"}` — 스프링이 아니라 **Railway 엣지가 내는 404** 이므로 그 주소에 배포본이 없는 것이다. 진단용 `/api/public/health` 추가. 배포하면 해제 |
| RR-06 | 해제 | `.env.local` 의 `VITE_API_BASE_URL` 을 배포 주소로 교체. `env:check` 를 `app:build`·`app:apk` 앞에 세워 localhost 면 앱 빌드를 거부한다 |
| RR-07 | 해제 | `054_analytics_events.sql` — `track()` 이 콘솔이 아니라 DB 로 적재. 검증 12건 |
| RR-08 | 해제 | ① 공개 `approve` 의 **휴대폰 우회**와 **계정 존재 노출**을 닫았다. ② **이메일 확인 절차를 켰다**(2026-09-21) — 확인 링크를 열기 전에는 로그인이 막히고 `/approve` 는 409. `verify:approve-guard` + `verify:signup` 이 검사한다. 휴대폰은 SMS 제공자가 없어 켤 수 없다 |
| RR-09 | 보류(결정) | 사업자 등록 후 Play Billing 연동. 그 전까지 결제 경로를 열지 않는다 |
| RR-10 | 부분 | AdMob **앱 ID** 적용됨(`capacitor.config.ts`, `AndroidManifest.xml`). **하단 배너 단위** `…/8555895404` 를 배너 두 자리에 적용(2026-09-21). **보상형 단위**만 미발급 — 비어 있으면 구글 테스트 광고가 나간다. `npm run ads:check` |
| RR-11 | 보류(결정) | 사업자 등록 후 Play Console 내부 테스트에서 검증 |

### 새로 생긴 배포 전제 — 자체 SMTP

이메일 확인을 켠 대가로 **확인 메일이 실제로 도착해야 가입이 된다.** Supabase 기본 SMTP 는
시간당 몇 통으로 막혀 있어서, 실측에서 연속 두어 번 만에 `over_email_send_rate_limit` 로
가입이 `429` 로 실패했다. 이 상태로 외부 가입자를 받으면 **가입이 되는 사람과 안 되는 사람이
갈린다.**

배포 전에 Supabase → Authentication → Emails 에서 자체 SMTP(Resend·SES 등)를 붙인다.
붙이기 전까지는 `MEBODY_AUTH_REQUIRE_EMAIL_VERIFICATION=false` 로 두는 편이 안전하다.
확인 링크가 돌아올 주소는 `mebody.app-url` 이고, Supabase 의 Redirect URLs 허용 목록에 있어야 한다.

### 범위에서 제외 — RR-03 안전 중단 응답

통증·어지럼을 이유로 응답을 분기하고 후속 안내를 내보내는 일은 증상 판단에 가까워 웰니스 셀프 체크의
범위를 넘는다고 판단했다(2026-09-21 결정). 문항 `instruction` 의 "통증이 있으면 중단합니다" 안내 문구는
그대로 두되, **중단 자체를 데이터로 기록하지 않는다.**

`bodyCodeCalculator` 의 `stoppedQuestionCodes` 옵션은 호출부가 아무도 채우지 않아 항상 빈 집합으로
들어오며 점수에 영향이 없다. 계산 경로 15곳에 얽혀 있어 제거가 곧 채점 로직 수술이므로, 동작이 같은 채로
그대로 둔다.

## 제한 베타로 낮추는 조건

아래를 모두 충족하면 **CONDITIONAL GO**로 재판정할 수 있다.

1. RR-01·RR-02·RR-04~RR-07을 해제한다. (RR-03 은 범위에서 제외 — 아래 참조)
2. 휴대폰 가입, 멤버십 결제, 상품 결제, 광고 보상을 feature flag로 숨긴다.
3. 이메일 확인과 비밀번호 복구가 실제 메일로 끝까지 동작하게 한다.
4. 계정 삭제를 앱과 외부 웹에서 실제 완료할 수 있게 한다.
5. Play Console 내부/비공개 테스트 APK에서 시스템 뒤로가기, 앱 재시작, 네트워크 단절을 통과한다.
6. 오류율과 `landing → result → first_action` 퍼널을 운영자가 조회할 수 있게 한다.

## 출시 기준 체크리스트

| 영역 | 결과 | 증거 | 설명 |
|---|---|---|---|
| 32문항 시작→결과 계산 | 부분 통과 | `CODE_VERIFIED` | 코드·빌드·계산 경로 존재. 실제 32문항 완주는 DB 쓰기 금지 때문에 이번 감사에서 재실행하지 않음 |
| 중단/새로고침 진행 보존 | 통과 | `CODE_VERIFIED` | localStorage progress, 답변·문항·draft 복구 검증 통과 |
| 브라우저 뒤/앞 | 통과 범위 있음 | `REPRODUCED`, `CODE_VERIFIED` | 랜딩↔동의 실제 재현, 자동 검증 29건 통과 |
| Android 시스템 뒤로가기 | 확인 불가 | `UNVERIFIED` | APK 실기기 미실행 |
| 결과 저장 실패 | 통과 범위 있음 | `CODE_VERIFIED` | 15초 deadline, 로컬 결과 표시, 다시 저장 UI 존재 |
| 개인정보/약관 | 실패 | `PRODUCTION_OBSERVED` | 두 문서 모두 플레이스홀더 |
| 동의 증적 | 실패 | `SCHEMA_VERIFIED` | consent 전용 테이블/컬럼 없음 |
| 계정 소유 확인·복구 | 실패 | `CODE_VERIFIED` | phone alias 복구 불가, 기본 검증 off |
| 회원 탈퇴 | 실패 | `SCHEMA_VERIFIED` | DB 준비만 적용, UI/API 없음 |
| 안전 중단 | 실패 | `CODE_VERIFIED` | 계산 타입은 중단 목록을 지원하지만 UI/저장 연결 없음 |
| RLS/비회원 결과 | 통과 범위 있음 | `SCHEMA_VERIFIED` | 핵심 테이블 RLS 활성, 익명 SELECT grant 없음, 결과 RPC 보호 적용 |
| 비밀키 노출 | 통과 범위 있음 | `CODE_VERIFIED` | 앱 runtime 소스에 service role key 없음. anon key만 클라이언트에 존재 |
| 결제/광고 | 실패 | `CODE_VERIFIED`, `PRODUCTION_OBSERVED` | 결제 서버 부재, 가짜 구매 token, 테스트 광고 |
| 핵심 분석 | 실패 | `CODE_VERIFIED` | 외부 sink와 핵심 이벤트 없음 |

## DB 적용 상태

| 기능 | SQL 파일 | 적용 DB | 서버 API | 앱 UI | 배포 동작 |
|---|---|---|---|---|---|
| 계정 탈퇴 준비 | 있음(현재 untracked) | `prepare_account_deletion()` 존재, 거래 FK `SET NULL` | 없음 | 없음 | 불가 |
| 오류 로그 | 있음(수정 중) | 테이블·RLS·권한 적용 | 불필요 | 자동 기록 | 공개 앱 코드에 호출 존재, 실제 적재는 미생성 원칙으로 미검증 |
| 결과 보호 | 있음 | 보호 RPC/RLS 적용 | 직접 Supabase | 사용 중 | 코드상 가능, 운영 데이터 쓰기 미실행 |
| Journey | 있음 | 테이블/RPC/템플릿 1개 | 일부 Spring 미사용, Supabase 직접 | 있음 | 계정 없는 읽기 범위 외 미검증 |
| 결제 | 있음 | 주문·결제·구독 테이블 | 코드 있음 | 있음 | 공개 API 404, 불가 |

Supabase migration ledger에는 초기/v1 일부만 기록돼 있으나 수동 Journey 계열 함수와 046 계정 삭제 변경은 DB에 존재한다. 적용 상태를 재현할 단일 migration history가 없다는 뜻이며 배포 안정성 위험이다.

## 검증 기록

- `npm run build`: 통과
- `npm run verify:types`: 타입 오류 0
- `npm run verify:flow`: 29/29 통과
- `npm run verify:journey-rules`: 112/112 통과
- `npm run ads:check`: 설정 검사 통과, 광고 단위 3개 모두 테스트 모드
- `mvn test -q`: 통과
- 공개 Vercel 홈/약관: HTTP 200, 약관 플레이스홀더 직접 확인
- 기록된 Railway 서버의 health/auth/billing/ads: HTTP 404 `Application not found`
- DB 조회: `BEGIN READ ONLY`, catalog/schema/policy/function/aggregate만 조회; 변경 없음

## 확인하지 못한 항목

- 실제 Android APK 설치·시스템 back·프로세스 kill·회전·네트워크 전환
- 신규 계정, 주문, 구독, 결제 생성 및 삭제
- Play Billing 샌드박스와 AdMob 실제/테스트 기기 동작
- 이메일 링크 수신과 비밀번호 재설정 완료
- 배포 서버는 주소 자체가 404여서 서버 설정의 실제 운영값 확인 불가

