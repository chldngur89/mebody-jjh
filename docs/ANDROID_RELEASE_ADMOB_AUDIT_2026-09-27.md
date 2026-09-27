# MEBODY Android APK·AdMob 출시 점검

- 점검일: 2026-09-27 (KST)
- 앱 패키지: `net.mebody.app`
- 점검 범위: 현재 로컬 코드와 미커밋 변경, 생성된 Android 산출물, Android API 37 에뮬레이터, 배포 앱·서버의 읽기 전용 응답
- 코드·DB·배포 설정 변경: 없음

## 판정

**공개 출시: NO-GO**

앱은 Android에서 실행되고 배너 광고 요청도 성공한다. 그러나 공개 출시 파일은 아직 없다. 현재 APK는 Android Debug 키로 서명됐고 release AAB는 unsigned다. Android 시스템 뒤로가기는 동의·로그인 같은 내부 화면에서 이전 화면으로 가지 않고 앱을 종료한다. 광고 동의를 거부해도 네이티브 AdMob 요청에 비개인화 설정이 전달되지 않으며 UMP 동의 흐름도 없다. 보상형 광고는 실 광고 단위가 없고 서버 검증은 배포 환경에서 꺼져 있다.

**광고와 보상형 기능을 숨긴 Play 내부 테스트: CONDITIONAL GO**

아래 P0 항목 중 release 서명, 시스템 뒤로가기, 인증 복귀 링크, 법적 문서를 먼저 고친 뒤 내부 테스트 트랙에서 실제 기기 검증을 시작할 수 있다. 공개 베타에서는 AdMob·광고 보상을 켜지 않는 편이 안전하다.

## 직접 확인한 결과

| 항목 | 결과 | 증거 등급 | 근거 |
|---|---|---|---|
| 웹 빌드·Capacitor 동기화·debug APK | 통과 | REPRODUCED | `npm run app:apk`, 23 MB `app-debug.apk` 생성 |
| release AAB 컴파일 | 부분 통과 | REPRODUCED | 19 MB `app-release.aab` 생성, `jarsigner` 결과 `jar is unsigned` |
| Android lint·unit task | 통과 | REPRODUCED | `bundleRelease lintDebug testDebugUnitTest` 성공, 앱 lint 오류 0 |
| TypeScript | 통과 | REPRODUCED | `npm run typecheck` 성공 |
| 이동·진행 정적 검증 | 통과 | REPRODUCED | `npm run verify:flow` 29건 성공 |
| 신규 설치·첫 실행 | 통과 | REPRODUCED | Android API 37 에뮬레이터에서 크래시 없이 랜딩 표시 |
| 앱 내부 화살표 뒤로가기 | 통과 | REPRODUCED | 동의 화면의 좌상단 화살표로 랜딩 복귀 |
| Android 시스템 뒤로가기 | 실패 | REPRODUCED | 랜딩→동의 후 시스템 Back을 누르면 런처로 종료. 로그인 진입 후에도 동일 |
| API 주소 | 통과 | CODE_VERIFIED + REPRODUCED | APK 자산에 Railway API 포함, 과거 Vercel API 호스트 없음 |
| target SDK | 통과 | CODE_VERIFIED | target/compile SDK 36 |
| AdMob 앱 ID·SDK 등록 | 통과 | CODE_VERIFIED + REPRODUCED | 병합 Manifest에 앱 ID, AD_ID 및 광고 SDK 컴포넌트 존재 |
| 결과 화면 배너 로드 | 통과(테스트 트래픽) | REPRODUCED | 에뮬레이터에서 `Test Ad` 배너 로드·노출·impression 확인, 콘텐츠/탭바 가림 없음 |
| 운영 광고 수익 발생 | 확인 불가 | UNVERIFIED | 에뮬레이터는 자동 테스트 기기이며 AdMob 콘솔 접근 없음 |
| 보상형 광고 실 단위 | 실패 | CODE_VERIFIED | 환경값이 비어 Google demo rewarded unit으로 대체됨 |
| AdMob SSV | 실패 | PRODUCTION_OBSERVED | `/api/ads/admob/ssv/health` 응답 `disabled` |
| `app-ads.txt` | 실패 | PRODUCTION_OBSERVED | 앱 URL 404, 서버 URL 500 |
| 개인정보·약관 운영자 정보 | 실패 | PRODUCTION_OBSERVED | 앱·서버 문서에 `[주소]`, `[문의 이메일]`, `[전화번호]` 유지 |

## 출시 차단 및 주요 문제

### P0-1. Play에 올릴 서명된 release 산출물이 없다

- 현재 `npm run app:apk`는 `assembleDebug`만 실행한다.
- 생성된 APK 서명자는 `CN=Android Debug`다.
- `bundleRelease`는 컴파일되지만 AAB는 unsigned다.
- `android/app/build.gradle`에 release signing config가 없고, versionCode는 `1`, versionName은 `1.0`으로 고정되어 있다. npm 앱 버전 `0.2.0`과도 다르다.
- 영향: Play 업로드 불가 또는 버전 업데이트 운영 실패.
- 개선: Play App Signing용 upload key를 안전한 외부 저장소에 만들고 환경 변수/비공개 properties로 release 서명을 구성한다. `app:aab` 스크립트와 versionCode 증가 절차를 추가한다. 키와 비밀번호는 Git에 넣지 않는다.

관련 코드: `android/app/build.gradle:6-24`, `package.json`의 `app:apk`.

### P0-2. Android 시스템 뒤로가기가 앱 내부 이동을 무시하고 종료한다

- 재현: 신규 설치 → `mebody Code 분석하기` → 동의 화면 → Android 시스템 Back.
- 기대: 랜딩으로 복귀.
- 실제: 앱 Activity가 닫히고 런처가 표시됨.
- 로그인 화면 진입 후 시스템 Back도 동일하게 앱을 종료했다.
- 앱 내부 화살표는 정상 동작하므로 React 히스토리 데이터 자체보다 Android Back과 SPA 히스토리의 연결이 빠진 문제다.
- 영향: Android 사용자가 입력 중 앱을 잃었다고 느끼며, 설문·로그인·마이페이지·상세 화면 전반에서 이탈 가능성이 높다.
- 개선: `@capacitor/app`의 `backButton` 이벤트를 연결해 오버레이→화면 히스토리→루트 종료 순으로 처리한다. 랜딩 루트에서만 종료하거나 한 번 더 누르기 안내를 사용한다. 설문 문항, 로그인 복귀, 상품 상세, 마이페이지, 모달 각각을 실제 기기에서 회귀 검증한다.

관련 코드: `src/utils/useFlowHistory.ts:23-45`, `src/utils/useFlowHistory.ts:74-80`. 현재 Android Back listener는 없다.

### P0-3. 광고 동의 문구와 네이티브 AdMob 요청이 다르다

- 쿠키 안내는 `필수만`이면 광고 개인화를 하지 않는다고 설명한다.
- 에뮬레이터에서 동의 값을 `rejected`로 둔 뒤 배너를 요청했지만 네이티브 요청 데이터에는 `npa`가 없었다.
- `AdSlot`은 동의값으로 `personalized`를 계산하지만 이 값은 웹 DOM 속성에만 쓰이고 `showBanner()`로 전달되지 않는다.
- AdMob UMP의 `requestConsentInfo`, `showConsentForm`, `canRequestAds`, 개인정보 옵션 진입점 호출도 앱 코드에 없다.
- 영향: 사용자의 선택과 실제 광고 처리가 다르며 해외 배포·AdMob 심사·개인정보 고지에서 문제가 된다.
- 개선: 앱 시작 시 UMP 동의 정보를 갱신하고 필요한 폼을 표시한 다음 `canRequestAds`일 때만 SDK를 초기화·광고 요청한다. 개인정보 화면에 선택 변경 진입점을 둔다. 앱의 자체 선택을 유지한다면 모든 배너·보상형 요청에 실제 선택과 일치하는 `npa`를 전달한다.

관련 코드: `src/components/CookieConsent.tsx:102-114`, `src/components/AdSlot.tsx:26-41`, `src/lib/ads.ts:65-105`.

### P0-4. 비밀번호 재설정 링크가 Android 앱으로 복귀할 경로가 없다

- 이메일·휴대폰 재설정 요청 모두 `window.location.origin`을 redirect URL로 사용한다.
- Capacitor 앱의 실제 origin은 로그에서 `https://localhost`로 확인됐다.
- AndroidManifest에는 launcher intent-filter만 있고 custom scheme 또는 verified app link가 없다.
- 영향: 재설정 메일 링크가 `https://localhost`로 향하거나 앱으로 돌아오지 못할 가능성이 높아 계정 복구가 끊긴다.
- 개선: 운영 HTTPS app link 또는 `net.mebody.app://auth-callback` 같은 명시적 callback을 정하고 Manifest intent-filter, Supabase redirect allowlist, 앱의 deep-link 처리까지 종단 간 구성한다.

관련 코드: `src/api/account.ts:102-107`, `src/api/signup.ts:194-202`, `android/app/src/main/AndroidManifest.xml:12-25`.

### P0-5. 운영 법적 문서가 완성되지 않았다

- 배포된 앱과 서버의 개인정보처리방침·이용약관 모두 `[주소]`, `[문의 이메일]`, `[전화번호]`를 노출한다.
- 영향: 사용자 문의·권리 행사 경로가 없고 Play 스토어 개인정보 URL로 제출하기 어렵다.
- 개선: 실제 운영자 정보, 개인정보 보호책임자/담당자, 광고 SDK 처리, 국외 이전·위탁, 계정 삭제 경로를 최종 확인해 앱과 서버 문서를 동시에 갱신한다.

관련 코드: `public/privacy.html:155-158`, `public/terms.html:156-158`.

## AdMob 세부 문제

### P1-1. 보상형 테스트 ID와 운영 모드가 섞인다

- 보상형 실 ID가 비어 공식 demo ID로 대체된다.
- `hasRealAdUnits()`는 결과 배너 또는 보상형 중 하나만 실 ID여도 `true`다.
- 현재 실 배너가 있으므로 AdMob 초기화와 보상형 요청 모두 `isTesting: false`가 된다. 즉 demo rewarded ID를 운영 모드로 요청하는 혼합 상태다.
- 개선: `isRealBanner(placement)`와 `isRealRewarded()`를 분리한다. release 빌드에서 실 보상형 ID가 없으면 보상 버튼 자체를 숨기고 demo 광고가 사용자에게 노출되지 않게 한다.

관련 코드: `src/lib/ads.ts:26-38`, `src/lib/ads.ts:72`, `src/lib/ads.ts:140-149`.

### P1-2. 서버 보상 검증이 꺼져 있어 앱이 보상을 청구한다

- 배포 서버 health는 `disabled`다.
- 앱은 SSV가 꺼져 있으면 광고 시청 결과를 받은 뒤 클라이언트에서 `claimRoutineBonus()`를 호출한다.
- 영향: 변조 앱·후킹 환경에서 광고 시청 없이 보상을 청구할 공격면이 남는다.
- 개선: AdMob 보상형 단위에 SSV callback URL을 등록하고 서버 서명·transaction 중복 방지·사용자 매핑을 staging에서 검증한 뒤 `MEBODY_ADS_SSV_ENABLED=true`로 전환한다. 공개 release에서는 SSV가 false면 보상형 UI를 숨긴다.

관련 코드: `src/components/codePlanShared.tsx:1552-1605`, 서버 `application.yml:88-91`.

### P1-3. `app-ads.txt`와 AdMob 앱 준비 상태를 확인할 수 없다

- `https://mebody-jjh.vercel.app/app-ads.txt`는 404다.
- 서버 도메인의 같은 경로는 500이다.
- 2025년 이후 AdMob에 추가된 새 앱은 app-ads.txt 미검증 시 광고 게재가 제한될 수 있다.
- 개선: Play 개발자 웹사이트로 사용할 도메인의 루트에 AdMob이 제공한 정확한 publisher 행을 게시한다. Play 등록정보의 개발자 웹사이트와 연결하고 AdMob에서 package `net.mebody.app`을 스토어 앱에 연결한 뒤 `Ready` 상태를 확인한다.

### P1-4. 배너 두 위치가 같은 광고 단위를 사용한다

- 결과 화면과 루틴 화면이 같은 배너 unit을 사용한다.
- 광고는 표시될 수 있지만 위치별 fill·CTR·정책 문제를 분리해서 볼 수 없다.
- 개선: 결과/루틴 각각 별도 unit을 만들고 이름과 환경값을 분리한다.

### P1-5. 실 광고를 안전하게 검증하는 운영 절차가 없다

- 에뮬레이터에서는 실제 unit 요청도 Google이 자동 테스트 트래픽으로 처리해 `Test Ad`가 정상 로드됐다.
- 이는 SDK·네트워크·레이아웃 통합 성공을 의미하지만 실제 수익 광고 게재를 증명하지 않는다.
- 개발 중 개인 기기에서 운영 광고를 클릭하면 invalid traffic 위험이 있다.
- 개선: AdMob 콘솔의 test device 또는 공식 demo unit만 사용해 검증하고, release 후보는 내부 테스트 트랙의 등록된 테스트 기기에서 광고 Inspector와 로그를 확인한다.

## 그 밖의 출시 위험

### P1-6. 서버 비밀번호 최소 길이가 1자다

- 배포 auth config는 이메일 확인 `true`지만 최소 비밀번호 길이는 `1`이다.
- 앱도 서버 값을 읽어 1자 비밀번호를 허용한다.
- 개선: 인증 공급자와 서버를 최소 8자 이상으로 통일하고 취약 비밀번호 제한을 적용한다.

### P1-7. 건강 관련 로컬 데이터 백업 범위가 넓다

- Manifest의 `android:allowBackup="true"`에 별도 backup/data extraction 규칙이 없다.
- 영향: 설문 진행, 체형 결과, 세션성 데이터가 기기 백업·이전 대상이 될 수 있다.
- 개선: 백업을 끄거나 민감 저장소를 제외하는 명시적 backup rules를 둔다.

### P2-1. 버전·최적화 운영이 준비되지 않았다

- Android version `1.0`과 npm version `0.2.0`이 다르다.
- release `minifyEnabled false`다. 첫 베타 차단 사유는 아니지만 크기·난독화·mapping 운영 기준을 정해야 한다.
- lint 경고에는 Manifest 태그 순서, monochrome launcher icon 부재, splash density 불일치가 있다.

## Android·AdMob에서 확인된 정상 항목

- target SDK 36으로 2026-08-31 이후 일반 앱 제출 기준을 충족한다.
- AdMob application ID가 Capacitor 설정과 AndroidManifest에 일치하게 들어 있다.
- 병합 Manifest에 `INTERNET`, `ACCESS_NETWORK_STATE`, `AD_ID` 및 Privacy Sandbox 광고 권한이 포함된다.
- 새 데이터 상태에서 앱이 정상 실행되고 랜딩 화면이 모바일 크기에 맞게 표시된다.
- 결과 화면의 adaptive banner가 로드됐고 탭바 위 콘텐츠를 덮지 않도록 하단 inset이 적용됐다.
- APK에 올바른 Railway API 주소가 들어 있고 기존 잘못된 API 호스트는 없다.

## 권장 수정·검증 순서

1. Android 시스템 Back 연동과 화면별 회귀 테스트.
2. release upload key·서명·AAB 스크립트·versionCode 자동 증가.
3. Android 인증 callback/deep link와 이메일 재설정 종단 간 테스트.
4. 개인정보·약관 운영자 빈칸 교체, Play 개인정보 URL과 계정 삭제 URL 준비.
5. UMP 동의, 광고 요청 gate, 개인정보 선택 변경, `npa` 전달 구현.
6. 광고 형식별 실/테스트 판정 분리. 실 rewarded ID 전에는 보상 UI 숨김.
7. SSV staging 검증 후 운영 활성화. false일 때 client fallback 보상을 공개 release에서 차단.
8. `app-ads.txt`, AdMob store link, readiness `Ready`, 결제 프로필 확인.
9. Play 내부 테스트 실제 기기: Android 8~16, 시스템 Back/제스처, 앱 재시작, 오프라인, 광고 미할당, 동의 거부/변경, 로그인·재설정.
10. 새 개인 개발자 계정이면 closed test 12명·14일 요건 확인 후 공개 신청.

## 실제 기기에서 남은 검증

- Android 3-button/gesture Back과 예측 뒤로가기
- 저사양 기기·회전·폰트 확대·다크 모드·네트워크 전환
- 이메일 확인 및 비밀번호 재설정 링크가 앱으로 돌아오는지
- AdMob UMP 강제 EEA 테스트, 동의 철회, 광고 미할당·오프라인 fallback
- 보상형 시청 완료/중도 종료/중복 콜백/SSV 지연/재시도
- AdMob Console의 app readiness, policy center, app-ads.txt verification, 실제 unit 형식
- Play Console의 Data safety, 광고 ID 선언, 콘텐츠 등급, 건강 관련 표현, 계정 삭제 URL

## 공식 기준

- Android App Bundle·서명: <https://developer.android.com/studio/publish/app-signing>
- Google Play target API: <https://developer.android.com/google/play/requirements/target-sdk>
- AdMob 테스트 광고: <https://developers.google.com/admob/android/test-ads>
- AdMob UMP: <https://developers.google.com/admob/android/privacy>
- AdMob app readiness: <https://support.google.com/admob/answer/10564477>
- app-ads.txt: <https://support.google.com/admob/answer/9363762>
- 새 개인 계정 테스트 요건: <https://support.google.com/googleplay/android-developer/answer/14151465>

