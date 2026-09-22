# MEBODY 제품·기술 현황

> 내부 개발·기획 기술팀을 위한 통합 현황 문서
>
> 기준일: 2026-08-27

MEBODY는 사용자가 자기 점검 설문을 통해 현재 몸의 정렬과 움직임 경향을 확인하고, 4축 기반 mebody 코드와 관리 콘텐츠를 살펴볼 수 있는 웰니스 서비스입니다.

MEBODY의 결과는 의료 진단, 통증 판독, 치료, 교정 또는 재활 처방이 아닙니다. 이상 증상이나 지속적인 통증이 있다면 의료 전문가의 판단을 우선해야 합니다.

## 문서 목적과 상태 표기

이 README는 다음 내용을 한곳에서 확인하기 위한 내부 기준 문서입니다.

1. 지금까지 실제로 구현된 사용자 플로우
2. 홈페이지, 12문항 간이 설문, 32문항 모바일 앱, Spring 서버와 Supabase의 연결 구조
3. 결과 페이지 이후 기능과 비즈니스 모델의 현재 상태

기능과 아이디어는 아래 상태로 구분합니다.

| 상태 | 의미 |
|---|---|
| `완료` | 현재 코드와 배포 흐름에 연결되어 있음 |
| `부분 구현` | 화면, 데이터 또는 기반 구조 일부만 존재함 |
| `미구현` | 현재 동작하는 기능이 없음 |
| `추후 확장` | 방향만 열어 두었고 구현을 약속하거나 확정하지 않음 |
| `확인 필요` | 코드·문구·운영 정책 사이의 정리가 필요함 |

## 저장소와 배포 구조

| 구성 | 저장소·배포 | 역할 |
|---|---|---|
| 홈페이지·서버 | [MebodyServer](https://github.com/MebodyCTO/MebodyServer) / [Railway 설정 주소](https://mebody-server-production.up.railway.app/) | 홈페이지, `/sample`, `/admin`, Spring API |
| 12문항 간이 설문 | [sample-questionnaire](https://github.com/MebodyCTO/MebodyServer/tree/main/sample-questionnaire) | 홈페이지에서 연결되는 간이 체크 React 앱 |
| 32문항 모바일 앱 | [mebody-jjh](https://github.com/chldngur89/mebody-jjh) / [Vercel](https://mebody-jjh.vercel.app/) | 본 설문, 결과, 코드 플랜, 회원 기능 |
| 인증·데이터 | Supabase | Auth, Postgres, Storage |
| 후속 외부 설문 | [Google Forms](https://docs.google.com/forms/d/e/1FAIpQLSfQyJ5UwkOYICfq-HPGR0f6CqbaDjmmu6nPgWsfz6XFb_0Vsg/viewform) | 현재 12문항 결과 CTA가 연결되는 설문 |

세부 서버 실행 방법과 API는 [서버 README](https://github.com/MebodyCTO/MebodyServer/blob/main/README.md), 간이 설문 빌드 방법은 [간이 설문 README](https://github.com/MebodyCTO/MebodyServer/blob/main/sample-questionnaire/README.md)를 참고합니다.

> 배포 확인: 설정과 기존 문서에 기록된 Railway 주소는 2026-08-27 기준 `/`, `/sample`, `/api/public/config`에서 HTTP 404를 반환합니다. 아래 홈페이지 흐름은 현재 코드 기준이며 Railway 서비스·도메인 연결 상태는 별도로 확인해야 합니다.

## 현재 사용자 플로우

### 홈페이지와 12문항 간이 설문

```text
사용자
→ Railway 홈페이지 `/`
→ “체형 코드 분석 시작” 클릭
→ 같은 오리진 `/sample`
→ 12문항 간이 체크
→ 브라우저에서 간이 코드 계산
→ 간이 결과 페이지
→ Google Forms 후속 설문
```

- 홈페이지의 주요 진단 CTA는 같은 Railway 오리진의 `/sample`로 이동합니다.
- 12문항은 번들된 문항 스냅샷과 로컬 미디어를 기본으로 사용합니다.
- 문항별 최적화 WebP 메인 이미지와 선택 ①·③ 이미지가 연결되어 있습니다.
- 선택 ②는 별도 선택 이미지를 표시하지 않고 메인 미디어를 유지합니다.
- 2번과 3번은 같은 이미지 세트를 공유하며, 10번과 12번은 기존 미디어 동작을 유지합니다.
- 답변은 브라우저에서 4축 간이 코드로 계산됩니다. 확정하기 어려운 축에는 `M(미확정)`이 포함될 수 있습니다.
- 결과 CTA는 현재 Google Forms로 이동합니다.
- 결과 하단의 홈페이지 버튼은 같은 오리진 `/`로 돌아갑니다.
- Supabase 문항 조회·응답 제출은 환경변수로 활성화할 수 있지만, 기본 간이 체크와 결과 표시는 DB 없이 동작합니다.

### 32문항 모바일 앱

```text
Vercel 모바일 앱
→ 랜딩·안내·동의
→ A~D 파트, 총 32문항
→ 클라이언트에서 4축 및 16개 코드 계산
→ Supabase에 결과 저장 시도
→ 무료 결과 페이지
→ 즉시 액션·코드 플랜·15분 루틴 화면
→ 회원가입·로그인·마이페이지
```

- 첫 문항은 번들된 `mebody_v1_32` 스냅샷으로 즉시 표시하고 같은 문항 세트의 Supabase `questions`를 백그라운드에서 갱신합니다.
- 현재 구성은 A 10개, B 6개, C 9개, D 7개로 총 32문항이며 별도 사전체크 문항은 없습니다.
- 32문항 완료 후 클라이언트에서 4축 코드와 아이덴티티를 즉시 계산합니다.
- Supabase 저장이 실패해도 현재 탭에서는 로컬 결과 화면을 계속 표시합니다.
- 로그인 회원의 최신 코드 정본은 `questionnaire_responses`의 최근 `completed` 결과입니다.
- `user_profiles.body_bti_code`는 빠른 표시용 캐시이며 제출 성공 시 갱신합니다.
- 비회원 결과 ID는 현재 탭의 `sessionStorage`에만 유지됩니다.

## 홈페이지·앱·서버 연결 아키텍처

```mermaid
flowchart LR
    USER[사용자]
    FORM[Google Forms 후속 설문]

    subgraph RAILWAY[Railway · mebody-server]
        HOME[홈페이지 /]
        SAMPLE[12문항 간이 설문 /sample]
        ADMIN[관리자 화면 /admin]
        API[Spring API /api/**]
    end

    subgraph VERCEL[Vercel · mebody-jjh]
        APP[32문항 모바일 앱]
    end

    subgraph SUPABASE[Supabase]
        AUTH[Auth]
        DB[(Postgres)]
        STORAGE[Storage]
    end

    USER --> HOME
    HOME -->|체형 코드 분석 시작| SAMPLE
    SAMPLE -->|결과 CTA| FORM
    SAMPLE -->|홈페이지 버튼| HOME
    USER -->|별도 URL 직접 접근| APP

    HOME -->|로그인·회원가입| AUTH
    HOME -->|Bearer token| API
    ADMIN --> API
    API -->|JPA| DB
    API -.->|Supabase JWT 검증| AUTH

    APP --> AUTH
    APP --> DB
    APP --> STORAGE
    APP -.->|관리자 콘솔 확인·열기| API

    HOME -.->|현재 직접 CTA 없음| APP
    SAMPLE -.->|URL 상수만 정의·UI 미사용| APP
```

정상적인 32문항 진단, 문항 로딩, 결과 계산과 결과 표시는 모바일 앱과 Supabase가 담당합니다. Spring 서버가 중단되어도 고객 진단 흐름이 막히지 않는 구조가 기본 원칙입니다.

### 연결 상태

| 연결 | 상태 | 현재 동작 |
|---|---|---|
| 홈페이지 → 12문항 간이 설문 | `완료` | 홈페이지 CTA가 같은 오리진 `/sample`로 이동 |
| 간이 결과 → Google Forms | `완료` | 결과 안내 카드가 외부 설문을 새 탭으로 열음 |
| 간이 결과 → 홈페이지 | `완료` | 결과 하단 버튼이 `/`로 이동 |
| 홈페이지 → Vercel 모바일 앱 | `미구현` | 앱 URL 설정은 있지만 사용자용 직접 CTA 없음 |
| 간이 결과 → Vercel 회원가입·정밀 체크 | `미구현` | `APP_SIGNUP_URL` 상수만 존재하고 현재 UI에서는 사용하지 않음 |
| 모바일 앱 → Supabase | `완료` | Auth, 문항·결과·콘텐츠 DB, Storage 직접 사용 |
| 모바일 앱 → Spring 서버 | `부분 구현` | `VITE_API_BASE_URL`이 있을 때 관리자 콘솔 상태 확인·열기에 사용 |
| Spring 서버 → Supabase Postgres | `완료` | 관리자·회원 API가 JPA로 직접 연결 |
| 홈페이지 인증 화면 → Supabase Auth → Spring API | `완료` | 브라우저가 Supabase 로그인 후 access token으로 서버 API 호출 |

### 연결 관련 환경변수

| 변수 | 소유 구성 | 현재 역할 |
|---|---|---|
| `MEBODY_APP_URL` | Spring 서버 | `/api/public/config`의 `appUrl`로 반환됨. 현재 홈페이지의 앱 이동에는 사용되지 않음 |
| `VITE_APP_URL` | 12문항 간이 설문 | `APP_SIGNUP_URL` 생성에 사용되지만 현재 결과 UI에서는 해당 URL을 사용하지 않음 |
| `VITE_HOMEPAGE_URL` | 12문항 간이 설문 | 결과의 홈페이지 버튼 목적지. 기본값은 `/` |
| `VITE_SAMPLE_RESULT_FORM_URL` | 12문항 간이 설문 | 결과 페이지의 Google Forms CTA를 배포 환경에서 덮어씀 |
| `VITE_API_BASE_URL` | 32문항 모바일 앱 | 마이페이지의 관리자 콘솔 상태 확인·열기. 없어도 진단과 결과는 동작함 |
| `VITE_SUPABASE_URL` | 32문항 모바일 앱 | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | 32문항 모바일 앱 | 브라우저용 Supabase anon key |

## 현재 구현 현황

### 완료

- 홈페이지와 `/sample` 연결
- 12문항 간이 설문 및 4축 간이 결과 계산
- 문항별 메인·선택 이미지 최적화와 선로딩
- 간이 결과 캐릭터와 축별 결과 표시
- Google Forms URL과 설문 참여 CTA
- `mebody_v1_32` 기반 총 32문항 구조: A 10개 + B 6개 + C 9개 + D 7개
- 4축 기반 16개 mebody 코드 계산
- Supabase `questions` 기반 문항 로딩
- Supabase `questionnaire_responses` 결과 저장
- 결과 페이지와 코드 설명
- Ver6 1·2순위 즉시 액션 카드와 상세 모달
- 코드 플랜과 오늘의 미션 수행률 UI
- 회원가입, 로그인, 마이페이지
- 로그인 회원의 최근 완료 결과 조회
- Supabase Storage 이미지 우선 로딩과 로컬 fallback

### 부분 구현

| 영역 | 현재 상태 | 남은 작업 |
|---|---|---|
| 15분 루틴 | `부분 구현` | UI와 조합 코드가 있으나 16개 코드별 콘텐츠·태그·조합 규칙 확정 필요 |
| 미션 관리 | `부분 구현` | 앱 UI와 서버 기본 테이블은 있으나 지속 관리 시퀀스까지 연결되지 않음 |
| 멤버십 | `부분 구현` | 플랜·체크아웃 화면과 DB 조회는 있으나 실제 결제는 mock |
| 상품 | `부분 구현` | 서버 상품 API shell은 있으나 판매·주문·결제 미구현 |
| 홈페이지와 모바일 앱 | `부분 구현` | URL 설정은 있으나 실제 사용자 CTA 연결 미완료 |

### 기술 부채·확인 필요

- 설정된 Railway 배포 주소가 현재 HTTP 404를 반환하므로 서비스·도메인 연결 상태를 확인해야 합니다.
- 간이 결과 JSON 원문에 `2차 정밀 체크`가 남아 있고 실행 시 `정밀 체크`로 치환됩니다.
- 간이 설문 README의 과거 GIF·Lottie 파일 규칙이 현재 WebP 질문 미디어 매핑과 다릅니다.
- 비회원 결과를 로그인 계정에 귀속하는 서버 API가 없습니다.
- `questionnaire_responses` RLS와 운영 환경의 권한 정책을 재점검해야 합니다.
- 회원가입 약관·개인정보 동의 저장 시각과 버전 이력이 없습니다.
- 주요 퍼널 이벤트 수집과 에러 로깅이 연결되지 않았습니다.
- 실제 결제 webhook과 결제 원장 테이블이 없습니다.

세부 우선순위는 [TODO.md](./TODO.md)를 기준으로 관리합니다.

## 결과 페이지 이후 현재 상태

결과 페이지와 코드 플랜까지는 구현되어 있지만, 그 이후의 지속 운영 방식과 수익화 모델은 아직 확정되지 않았습니다. 아래 항목은 현재 제품 상태를 기록한 것이며 사업 전략 확정안이 아닙니다.

| 영역 | 현재 상태 | 향후 결정 |
|---|---|---|
| 결과 이후 이메일 | `미구현` | 추후 확장 |
| 5분 데일리 미션 | `부분 구현` | 기본 미션·루틴 UI는 있으나 콘텐츠와 운영 방식 미정 |
| 15분 루틴 | `부분 구현` | 코드별 데이터와 조합 규칙 확정 필요 |
| 정기 구독 | `부분 구현` | 체크아웃 mock만 존재하며 결제사·가격·혜택 미정 |
| 케어팩·도구 판매 | `부분 구현` | 상품 API shell만 존재하며 상품 구성·판매 방식 미정 |
| 주간 리포트 | `미구현` | 추후 확장 |
| 이메일 발송 도구 | `미구현` | 도구 미선정, 추후 결정 |
| 사용자 리텐션 정책 | `미구현` | 데이터 수집 후 결정 |
| 결과 재측정 주기 | `미구현` | 추후 결정 |

## 결과 이후 비즈니스 모델 — 추후 확장

- 핵심 유료 가치: 미정
- 무료/유료 기능 경계: 미정
- 구독 여부 및 가격: 미정
- 케어팩 판매 여부: 미정
- 이메일·알림 운영 방식: 미정
- 5분 → 15분 콘텐츠 운영 방식: 미정
- 핵심 성과지표: 미정
- 담당자 및 결정 일정: 미정

구독, 케어팩, Drip Email은 현재 확정된 전략이나 운영 기능이 아닙니다. 의사결정 이후 이 섹션과 구현 현황을 함께 갱신합니다.

## 향후 기술 확장 지점

아래 항목은 구현 일정이 확정된 약속이 아니라 현재 아키텍처에서 검토할 수 있는 확장 지점입니다.

- 홈페이지 또는 간이 결과에서 Vercel 정밀 앱으로 연결
- 간이 결과 코드·답변을 정밀 앱으로 전달할지 정책 결정
- 결과 이후 콘텐츠 시퀀스와 상태 모델 설계
- 이메일 수신 동의·철회와 동의 버전 이력 저장
- 미션 시작·완료 이벤트 수집
- 실제 구독 결제와 webhook 검증
- 상품·주문·배송 시스템
- 관리자 콘텐츠 운영 화면
- 재측정 결과와 과거 결과 변화 비교

## 기술 스택

- React 18
- TypeScript
- Vite 6
- Supabase JS Client
- lucide-react
- Vercel

서버는 Java 17, Spring Boot 3.3, Spring Security, Spring Data JPA와 PostgreSQL을 사용합니다.

## 모바일 앱 로컬 실행

### 환경변수

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# 선택값. 마이페이지의 관리자 콘솔, 결제(/api/billing/*), 보상형 광고 SSV 설정 조회에 씁니다.
# 진단·문항·결과는 이 서버 없이도 동작해야 합니다.
VITE_API_BASE_URL=https://mebody-server-production.up.railway.app

# 선택값. 결과 공유용 카카오 JavaScript 키. 비어 있으면 카카오 버튼만 숨고
# OS 공유·링크 복사는 그대로 동작합니다.
VITE_KAKAO_JAVASCRIPT_KEY=

# 선택값. 공유 링크의 기준 주소. 브라우저에서는 비워두면 현재 origin 을 씁니다.
# 네이티브 앱은 origin 이 localhost 라서 이 값이 없으면 배포 주소로 대체합니다.
VITE_PUBLIC_SITE_URL=
```

```env
# AdMob 광고 단위 ID. 앱 ID 와 다른 값입니다 — 앱 ID 는 '~', 광고 단위는 '/' 입니다.
# 앱 ID(ca-app-pub-...~...)는 capacitor.config.ts 와 AndroidManifest.xml 에 이미 있습니다.
# 비어 있으면 그 자리에 구글 "테스트 광고"가 나갑니다(수익 0).
VITE_ADMOB_BANNER_RESULT=ca-app-pub-................/..........
VITE_ADMOB_BANNER_ROUTINE=ca-app-pub-................/..........
VITE_ADMOB_REWARDED=
```

`npm run ads:check` 가 앱 ID 와 단위 ID 를 형식까지 검사하고, 어느 자리가 테스트 광고로
떨어지는지 알려줍니다.

#### `VITE_API_BASE_URL` 은 빌드에 박힙니다

Vite 의 `VITE_*` 는 **빌드 시점에 코드로 들어갑니다.** 실행 중에 읽지 않습니다. 그리고
`.env.local` 은 `dev` 와 `build` 양쪽에서 모두 이깁니다. 그래서 로컬 서버를 보려고 잠깐
`http://localhost:8081` 로 바꿔 둔 값이 그대로 APK 에 박히는 사고가 납니다. 단말에는 그 서버가
없으니 결제·주문·휴대폰 가입·탈퇴가 전부 조용히 실패합니다.

그래서 `npm run env:check` 를 `app:build` 와 `app:apk` 앞에 세워 두었습니다. API base 가
로컬 주소이거나 https 가 아니면 **앱 빌드를 거부합니다.** 웹 빌드(`npm run build`)는 막지 않습니다.

로컬 서버와 같이 테스트할 때만 `VITE_API_BASE_URL=http://localhost:8081` 로 바꾸고, APK 를
만들기 전에 반드시 되돌립니다.

### 실행과 빌드

```bash
npm install
npm run dev
```

접속: http://localhost:3000

```bash
npm run build
git diff --check
```

## 모바일 앱이 사용하는 Supabase 테이블

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

## 이미지 저장 규칙

Supabase Storage bucket: `images`

- 캐릭터: `characters/{BODY_CODE}.png`
- 축 아이콘: `axis/axis-neck.png`
- 축 아이콘: `axis/axis-shoulder.png`
- 축 아이콘: `axis/axis-pelvis.png`
- 축 아이콘: `axis/axis-flexibility.png`
- 16가지 체형 이미지: `body-types/bodyTypesImage.png`

캐릭터 이미지는 Storage를 우선 사용하고, 실패하면 `app_images`, 마지막으로 로컬 fallback을 사용합니다.

## 결과 기억 정책

- 비회원: 현재 탭 `sessionStorage`에만 결과 ID를 보관합니다.
- 비회원: 새 탭, 새 브라우저 또는 공유 URL 단독 진입은 랜딩으로 보냅니다.
- 공유 링크에는 결과 ID 가 없으므로 받은 사람에게 원 사용자의 결과가 복원되지 않습니다.
- 로그인 회원: `questionnaire_responses.user_id` 기준 최신 완료 결과를 불러옵니다.
- Supabase Auth 세션 저장은 유지합니다.

## 회원가입 — 이메일과 휴대폰

`구현 완료` — 둘 다 **가입 즉시 로그인**됩니다. 확인 절차 코드는 이미 들어 있고 설정값만 바꾸면 켜집니다.

### 지금 상태 — 이메일은 확인 메일, 휴대폰은 즉시 가입

**2026-09-21 부터 이메일 가입에는 확인 메일이 붙습니다.** 링크를 열기 전에는 로그인이 막힙니다.
휴대폰은 그대로 그 자리에서 가입되고 로그인 상태가 됩니다.

> **⚠️ 배포 전에 반드시**: Supabase **기본 SMTP 는 시간당 몇 통**으로 막혀 있습니다. 한도를 넘기면
> 가입 자체가 `429` 로 실패합니다(실측: 연속 두어 번 만에 `over_email_send_rate_limit`).
> 외부 가입자를 받기 전에 Supabase → Authentication → **Emails 에서 자체 SMTP**(Resend·SES 등)를
> 붙이세요. 붙이기 전까지는 `MEBODY_AUTH_REQUIRE_EMAIL_VERIFICATION=false` 로 두는 편이 낫습니다.
>
> 확인 링크가 돌아올 주소는 서버의 `mebody.app-url` 이고(가입 요청에 `redirect_to` 로 보냅니다),
> 그 주소가 Supabase 의 **Redirect URLs 허용 목록**에 있어야 링크가 동작합니다.

| 항목 | 지금 | 바꾸는 방법 |
|---|---|---|
| 이메일 확인 메일 | **있음 (ON)** | 끄려면 `MEBODY_AUTH_REQUIRE_EMAIL_VERIFICATION=false` |
| 휴대폰 인증번호 | 없음 | SMS 제공자 연결 후 `MEBODY_AUTH_REQUIRE_PHONE_VERIFICATION=true` |
| 비밀번호 길이 | 1자 (사실상 제한 없음) | `MEBODY_AUTH_MIN_PASSWORD_LENGTH=8` |
| 비밀번호 확인 칸 | 없앰(앱·홈페이지 둘 다) | `AuthScreen.tsx` 와 `static/index.html` 에 다시 넣어야 함 |
| 복구용 이메일 | 휴대폰 가입에서 선택 입력 | 필수로 바꾸려면 `AuthScreen.tsx` 검사 추가 |
| 승인 대기 계정 | **닫힘** (확인 절차가 켜져 있어 `/approve` 가 409) | 확인 절차를 끄면 다시 열림 |
| 이름 | 선택 | — |
| 이메일/휴대폰 선택 | 입력하는 대로 자동 판별 | — |

휴대폰은 왜 안 켜는가: Supabase 전화 제공자가 꺼져 있어 **인증 문자를 보낼 수단 자체가 없습니다.**
별칭 주소(`01012345678@phone.mebody.net`)는 받을 수 있는 메일함이 아니라서 이메일 확인으로 대신할
수도 없습니다. SMS 제공자를 붙인 뒤에 켤 수 있습니다. 휴대폰 가입자에게 복구 수단을 주려면
가입할 때 **복구용 이메일**을 적게 하세요(지금은 선택 입력).

확인 메일을 기다리는 계정도 **동의 시각은 남깁니다.** 동의는 확인 메일과 무관하게 그 순간에 실제로
한 행위이고, 남기지 않으면 `auth.users` 에 사람은 생겼는데 동의 증적이 없는 상태가 됩니다.
프로필 본문(이름·연락처)만 확인 뒤 첫 로그인에서 채웁니다.

막는 것은 그 밖에 계정을 만들 수 없는 입력뿐입니다. 빈 값, 그리고 이메일도 번호도 아닌 값입니다.
Supabase 는 관리자 생성 경로에서 비밀번호 길이를 보지 않습니다(실측: 1자도 생성·로그인 됨).
지금 남아 있는 제한은 전부 우리 설정이고 값 하나로 되돌릴 수 있습니다.

스위치는 서버의 `mebody.auth` 블록에 있습니다(`mebody-server/src/main/resources/application.yml`).
앱 코드는 손대지 않아도 됩니다. 현재 값은 `GET /api/public/auth/config` 로 확인할 수 있습니다.

### 승인 대기로 남는 계정이 없게

가입 창구가 둘입니다. 앱(`mebody-jjh`)과 홈페이지(`mebody-server` 정적 페이지)이고, 둘 다
`POST /api/public/auth/signup` 을 거쳐 승인된 상태로 계정을 만듭니다.

그래도 승인 대기로 남을 수 있는 경로가 둘 있습니다.

1. 서버에 못 붙어 앱이 Supabase 로 직접 가입한 경우
2. 예전에 인증 메일 방식으로 만들어 둔 계정

이 계정들은 로그인할 때 `email_not_confirmed` 로 막힙니다. 그래서 **로그인이 그 이유로 실패하면
앱과 홈페이지가 `POST /api/public/auth/approve` 를 부르고 한 번만 다시 로그인합니다.**
승인만 할 뿐 로그인을 시켜주지는 않으므로 비밀번호는 여전히 맞아야 합니다.

이 엔드포인트는 로그인 전에 불려야 해서 누구나 부를 수 있습니다(`permitAll`). 그래서 두 가지를
지킵니다.

1. **확인 절차가 켜져 있으면 거절합니다(409).** 켜 놓고도 여기로 풀린다면 확인 절차가 없는 것과
   같습니다. 예전 코드는 `!id.isPhone() && emailVerificationRequired()` 로 검사해서 **휴대폰
   식별자는 검사를 통째로 건너뛰었습니다** — `MEBODY_AUTH_REQUIRE_PHONE_VERIFICATION=true` 로
   켜 두어도 번호를 보내면 그냥 승인됐습니다. 지금은 식별자 종류에 맞는 스위치를 봅니다.
2. **계정이 있는지 알려주지 않습니다.** 응답이 갈리면 이메일·번호를 하나씩 넣어 보는 것만으로
   회원 명단을 캘 수 있습니다. 그래서 있든 없든, 이미 승인됐든 이번에 풀었든 응답이 같습니다
   (`{approved, loginEmail}` 뿐). 비밀번호 재설정(`/reset`)은 처음부터 같은 규칙이었고
   승인만 빠져 있었습니다.

`npm run verify:approve-guard` 가 두 경우를 다 검사합니다. 확인 절차를 켠 서버에 대고 돌리면
거절(409)까지 확인합니다.

```bash
MEBODY_AUTH_REQUIRE_EMAIL_VERIFICATION=true \
MEBODY_AUTH_REQUIRE_PHONE_VERIFICATION=true mvn spring-boot:run
```

### 왜 서버를 거치는가

Supabase 프로젝트의 Confirm email 이 켜져 있습니다. 앱에서 그냥 가입하면 확인 메일을 열기 전까지
로그인이 막힙니다(실측: `email_not_confirmed`). 확인된 상태로 계정을 만들려면 서비스 롤 키가 필요한데
그 키는 앱에 둘 수 없습니다. 그래서 가입만 `POST /api/public/auth/signup` 을 거칩니다.
서버에 못 붙으면 이메일 가입은 예전처럼 Supabase 직접 가입으로 되돌아갑니다.

### 휴대폰은 왜 별칭 이메일인가

Supabase 의 전화 제공자가 꺼져 있어 번호로는 **가입도 로그인도** 거부됩니다
(실측: `phone_provider_disabled`). 그래서 번호를 `01012345678@phone.mebody.net` 모양의 이메일로 바꿔
계정을 만들고, 로그인할 때도 앱이 같은 규칙으로 번호를 바꿔 보냅니다.

- 변환 규칙은 두 곳에 같이 있습니다. `src/lib/identifier.ts` 와 `SignupIdentifier.java` 입니다.
  **한쪽만 바꾸면 가입은 되는데 로그인이 안 됩니다.**
- 도메인도 두 곳이 같아야 합니다. 앱 `VITE_PHONE_ALIAS_DOMAIN`, 서버 `mebody.auth.phone-alias-domain`.
- 실제 번호는 `auth.users.phone` 에 국제표기(`+8210...`)로, 메타데이터에는 `phone_number` 로 함께 남깁니다.
  나중에 전화 제공자를 켜고 `MEBODY_AUTH_PHONE_MODE=native` 로 바꿀 때 쓰려고 미리 넣어둔 값입니다.
- 별칭 주소는 받을 수 있는 메일함이 아닙니다. 그래서 휴대폰 계정은 비밀번호 재설정을 지원하지 않습니다.

### 휴대폰 계정의 비밀번호 복구

별칭 주소에는 메일함이 없어 재설정 메일을 보낼 수 없습니다. 그래서 가입 화면에서
**복구용 이메일을 적으면 그 주소가 계정의 이메일이 됩니다.** 번호는 `auth.users.phone` 에 남습니다.

- 번호로 로그인하는 경로만 서버를 거칩니다(`POST /api/public/auth/login`).
  서버가 번호로 계정을 찾아 비밀번호까지 확인한 뒤 세션을 돌려줍니다.
  번호 → 이메일을 그냥 알려주면 누구나 번호로 이메일을 캐낼 수 있어서입니다.
- 재설정은 `POST /api/public/auth/reset`. **계정이 있든 없든 같은 응답**입니다.
  응답이 갈리면 번호만 넣어 가입 여부를 알아낼 수 있습니다.
- 복구용 이메일을 안 적으면 번호로만 로그인할 수 있고 재설정은 되지 않습니다. 화면에 그대로 적혀 있습니다.

### 사람이 해야 하는 것 (휴대폰 인증을 켤 때)

1. Supabase → Authentication → Providers → Phone 활성화, Twilio 등 SMS 제공자 연결
2. `MEBODY_AUTH_PHONE_MODE=native`, `MEBODY_AUTH_REQUIRE_PHONE_VERIFICATION=true`
3. 기존 별칭 계정을 번호 계정으로 옮기는 이전 작업 (별칭 계정에 이미 번호가 들어 있습니다)

## 계정 탈퇴 (`db/journey/046`)

앱의 「내 상태」 맨 아래 **회원 탈퇴**. 되돌릴 수 없어 두 번 묻습니다.

두 걸음으로 처리합니다. 순서가 중요합니다.

1. `prepare_account_deletion()` — 막아야 할 것을 막고, CASCADE 가 닿지 않는 것을 지우고,
   남을 거래 기록 수를 돌려줍니다
2. 서버가 서비스 롤로 `auth.users` 삭제 — 나머지는 외래키 CASCADE 가 지웁니다

인증 계정 삭제를 마지막에 두는 이유는 중간에 실패해도 계정이 그대로 남아 다시 시도할 수 있게 하기
위해서입니다. 반대로 하면 계정만 사라지고 데이터가 떠도는 상태가 생깁니다.

### 지우는 것과 남기는 것

- **지웁니다** 진단 응답, 저니, 리포트, 미션, 적립금 원장, 배송지, 프로필
- **남깁니다** 주문·결제·구독. 전자상거래법상 보존 대상입니다.
  046 이 이 세 테이블의 외래키를 `ON DELETE SET NULL` 로 바꿉니다.
  **바꾸기 전에는 계정을 지우면 결제 기록이 CASCADE 로 함께 사라졌습니다.**
  탈퇴 후에는 거래 기록은 남고 구매자 연결만 끊깁니다.
- **막습니다** 등록한 상품이 있는 판매자는 탈퇴할 수 없습니다. 주문을 받을 사람이 없어집니다.

탈퇴한 계정의 토큰은 만료 전까지 서명이 유효합니다. `CurrentUserService` 가 `auth.users` 존재를
먼저 확인해 401 로 끊습니다. 없으면 프로필을 새로 만들려다 외래키에 걸려 500 이 납니다.

## 이벤트 수집 (`db/journey/054`)

`src/lib/analytics.ts` 의 `track()` 이 이제 실제로 남깁니다. 외부 SDK 없이
Supabase `analytics_events` 에 바로 넣습니다. Spring 서버를 거치지 않아 서버가 없어도 동작하고,
수집이 실패해도 화면을 막지 않습니다.

**개인 식별 값을 넣지 않습니다.** 테이블에 `user_id` 컬럼이 아예 없습니다. 있으면 개인정보가 되어
처리방침과 파기 대상이 되고 탈퇴할 때 지울 곳이 하나 더 늘어납니다.
대신 `session_id` 로 한 번의 방문 안에서만 이어 봅니다. 탭을 닫으면 끊깁니다.
`props` 에 들어갈 수 있는 값은 타입이 막고 있습니다(`body_code`·`share_channel`·`ref`·`reason`).

같은 세션이 1분에 같은 이벤트를 60번 넘게 보내면 조용히 버립니다. 180일이 지난 기록은 지웁니다.
`app_error_log` 와 같은 방식입니다.

지금 심어둔 지점입니다.

| 이벤트 | 위치 |
|---|---|
| `landing_viewed` | 첫 화면 |
| `questionnaire_started` · `questionnaire_completed` | 진단 시작·완료 |
| `result_viewed` | 결과가 실제로 그려진 순간 |
| `journey_started` · `mission_completed` | 14일 관리 |
| `result_share_*` | 공유 |
| `shared_link_opened` · `shared_questionnaire_*` | 공유 유입 |

읽기는 관리자만 됩니다. 익명은 남기기만 하고 읽지 못합니다.

## 가입 동의 기록 (`db/journey/055`)

가입 화면에 체크박스는 있었는데 **동의했다는 사실이 어디에도 남지 않았습니다.**
`user_profiles` 에 `terms_agreed_at`·`privacy_agreed_at`·`marketing_agreed_at` 을 더했습니다.

기존 8개 계정은 NULL 입니다. 그때는 기록하지 않았기 때문입니다.
055 를 적용하지 않은 DB 에서도 가입은 그대로 됩니다. 서버가 조용히 지나갑니다.

비회원이 진단 전에 누르는 동의는 아직 담기지 않습니다. 그 시점에는 계정이 없어 붙일 곳이 없고,
`questionnaire_responses` 에 담으려면 044·045 로 잠근 저장 함수의 시그니처를 바꿔야 합니다.
047 에서 겪은 함수 중복 사고와 같은 위험이라 따로 다룹니다.

## 전문가 확장 (`db/journey/052`·`053`·`056`·`059`·`060`) — Phase 1~3 동작

트레이너가 고객에게 초대 링크를 보내고, 고객이 **직접 눌러 동의하면** 체형 결과 한 장을 봅니다.

### 흐름

```
전문가 콘솔(/me → 고객 관리) → 초대 링크 만들기 → 카카오톡 전달
  → 고객이 앱에서 링크 열기(/?invite=<token>) → 로그인 → 동의
  → 전문가 콘솔에서 결과 확인
```

### 지켜야 하는 것 네 가지

1. **동의는 누르는 것이지 링크를 여는 것이 아닙니다.** 링크를 여는 것만으로 연결되면
   카카오톡 미리보기 크롤러나 실수로 누른 손가락이 동의를 대신합니다.
2. **동의 전에는 아무것도 없습니다.** 이름도, 코드도, "결과가 있는지" 조차 내려주지 않습니다.
   그것도 그 사람에 대한 정보입니다.
3. **거둘 수 있어야 동의입니다.** 앱 마이페이지 → 연결된 전문가에서 끊습니다. 끊는 순간부터
   `get_client_response()` 가 0행을 돌려줍니다.
4. **토큰은 1회용·7일 만료입니다.** 수락한 뒤에는 목록에서도 링크를 다시 내려주지 않습니다.
   계속 주면 그 링크로 다른 계정을 묶을 수 있습니다.

### 권한을 어디서 판단하는가

| 질문 | 판단하는 곳 |
|---|---|
| 지금 로그인한 사람이 활성 전문가인가 | `current_professional_id()` (052) |
| 이 전문가가 이 고객을 볼 수 있는가 | `get_client_response()` (053) |

둘 다 DB 함수입니다. 서버는 `UserScopedDb` 로 **검증된 토큰의 subject** 를
`request.jwt.claims` 에 심고 그 함수를 부를 뿐, 같은 판단을 Java 로 다시 구현하지 않습니다.
두 벌이 되면 언젠가 갈라지고, 갈라지는 쪽은 늘 느슨한 쪽입니다.

### 경로

| 경로 | 누가 | 하는 일 |
|---|---|---|
| `GET /api/professional/me` | 전문가 | 내 정보 |
| `GET /api/professional/clients` | 전문가 | 고객 목록 |
| `POST /api/professional/clients/invite` | 전문가 | 초대 만들기 |
| `GET /api/professional/clients/{id}` | 전문가 | 고객 결과 1건 (동의 없으면 404) |
| `DELETE /api/professional/clients/{relationId}` | 전문가 | 관계 끊기 |
| `GET /api/public/professional/invite/{token}` | 누구나 | 미리보기 — **전문가 이름만** |
| `POST /api/invites/{token}/accept` | 로그인한 회원 | 동의 |
| `GET /api/invites/relations` | 로그인한 회원 | 내가 연결한 전문가 |
| `DELETE /api/invites/relations/{id}` | 로그인한 회원 | 동의 거두기 |
| `POST /api/admin/professionals` | 관리자 | 전문가 계정 발급 |

미리보기만 로그인 없이 열립니다. 누가 부른 링크인지 모르는 채로 로그인하라고 할 수 없어서입니다.
없는 토큰과 만료 토큰의 답이 같아서, 토큰을 넣어 보며 무언가를 캐낼 수 없습니다.

**수락은 반드시 로그인 상태여야 합니다.** 서버가 토큰이 가리키는 사람이 아니라 *지금 로그인한
사람* 을 고객으로 묶기 때문에, 링크를 주운 사람이 남의 계정을 연결할 방법이 없습니다.

### Phase 2 — 수행 기록

전문가가 고객 상세를 열면 체형 결과 아래에 **14일 루틴 수행 기록**이 같이 뜹니다.
진행률, 일자별 막대(어디서 멈췄는지가 한눈에), 고객이 미션 뒤에 남긴 피드백입니다.

| 경로 | 하는 일 |
|---|---|
| `GET /api/professional/clients/{id}/journey` | 진행률 · 일자별(최근 14일) · 피드백(최근 10건) |

`get_client_journey_summary()`(056)가 **jsonb 한 덩어리**로 돌려줍니다. 셋으로 쪼개 부르지
않는 이유는, 그 사이에 고객이 동의를 거두면 화면 절반은 옛 데이터·절반은 빈 값이 되기
때문입니다. 한 번에 한 시점을 읽습니다.

통과 조건은 `get_client_response()` 와 **똑같습니다.** 어긋나면 NULL 이고 서버가 404 로 옮깁니다.
루틴을 아직 시작하지 않은 고객은 NULL 이 아니라 `has_journey=false` 입니다 — 둘을 같은 404 로
뭉개면 전문가가 "권한이 없나" 하고 헤맵니다.

**동의 범위가 넓어졌습니다.** Phase 1 의 동의 문구는 "체형 코드와 4축 요약, 진단 날짜" 뿐이었는데
Phase 2 는 미션 수행 기록과 **고객이 남긴 메모 내용**까지 봅니다. 문구를 그대로 두고 범위만
넓히면 받지 않은 동의를 쓰는 셈이라, 동의 화면에 두 줄을 더했습니다.

### 주간 활성 전문가 (`professional_activity_log`)

로드맵의 Phase 2 는 "테이블 추가 없음" 이라고 적혀 있었지만, 같은 문서의 지표가
"한 주에 고객 화면을 한 번이라도 연 전문가 / 전체 전문가" 입니다. 이 숫자는 **전문가별 행**이
있어야 셀 수 있고, `analytics_events`(054)는 개인 식별 값을 일부러 넣지 않는 테이블이라
쓸 수 없습니다. 그래서 작은 로그를 따로 둡니다. 로드맵 쪽이 틀렸습니다.

남기는 것은 누가·누구를·무엇을·언제 뿐이고 **본 내용은 남기지 않습니다.**
쓰기는 서버만 합니다 — 앱이 직접 쓸 수 있으면 지표를 원하는 대로 부풀릴 수 있습니다.
180일이 지나면 `purge_professional_activity_log()` 로 지웁니다.

```sql
-- 지난 7일 활성 전문가 비율
SELECT count(DISTINCT l.professional_id)::numeric
       / NULLIF((SELECT count(*) FROM public.professionals WHERE status = 'ACTIVE'), 0)
  FROM public.professional_activity_log l
 WHERE l.created_at > now() - interval '7 days';
```

### 콘솔에 들어가는 법

전문가·판매자도 로그인하면 상단 「콘솔」 링크가 보입니다(예전에는 관리자만 보여서,
주소창에 `/admin` 을 직접 쳐야 쓸 수 있었습니다). 들어가면 역할에 맞는 탭이 먼저 열립니다 —
관리자는 회원 관리, 전문가는 고객 관리, 판매자는 상품 관리.

### 화면 확인용 가상 데이터

수행 기록이 비어 있으면 화면이 맞게 만들어졌는지 볼 수 없습니다.

```bash
npm run seed:professional            # 전문가 1명 + 고객 2명(잘 따라오는 사람 / 멈춘 사람)
npm run seed:professional -- --clean # 만든 것 전부 삭제
```

**실제 회원 데이터는 건드리지 않습니다.** `demo-pro-…` · `demo-cli-…` 전용 계정을 새로 만들어
거기에만 넣습니다. 되돌리지 못하는 가짜 데이터는 운영 DB 에서 쓰레기가 됩니다.

### Phase 3 — 미션 배정

전문가가 고객의 오늘 미션에 동작을 추가합니다. 앞의 둘과 달리 **남의 앱에 할 일을 넣는**
기능이라 셋을 못 박았습니다.

1. **내용은 만들 수 없고 고를 수만 있습니다.** 동작 설명을 직접 쓰게 하면 이 앱이 검증되지 않은
   지시를 남의 몸으로 나르는 통로가 됩니다. 배정은 `immediate_action_content` 23개 중 고르기만
   되고, 덧붙일 수 있는 것은 메모 200자뿐입니다.
2. **하루 3개까지.** 제한이 없으면 앱이 숙제 창고가 되고 고객은 앱을 지웁니다.
3. **고객이 한 일은 못 없앱니다.** 취소는 아직 `scheduled` 인 것만입니다.

| 경로 | 하는 일 |
|---|---|
| `GET /api/professional/contents` | 배정 가능한 동작 23개 |
| `POST /api/professional/clients/{id}/missions` | 배정 (하루 3개 · 메모 200자) |
| `DELETE /api/professional/missions/{id}` | 시작 전 배정 거두기 |

**적립금은 그대로 대상입니다.** 안전한 이유는 057 의 월 상한입니다 — 전문가가 미션을 100개
만들어도 그 고객의 한 달 무료 적립은 49원을 넘지 못합니다. 예외를 두면 고객이 트레이너 숙제를
할수록 손해 보는 구조가 됩니다.

**앱은 출처를 보여줍니다.** 오늘 화면에 「담당 전문가가 추가한 동작입니다 — "…"」가 뜹니다.
감추면 모르는 미션이 갑자기 생긴 것처럼 보이고, 그건 사용자가 앱을 의심할 이유가 됩니다.

#### 붙이는 날은 `current_day` 가 아닙니다

059 는 배정할 날을 `user_journeys.current_day` 에서 읽었습니다. **앱은 그 컬럼을 보지 않습니다** —
`started_at` 으로 매번 계산합니다(`computeCurrentDay`). 그 컬럼은 뒤처져 있어서, 실측에서
저장값 10·3·2일차 vs 실제 14·14·7일차로 벌어져 있었습니다. 그 상태로 배정하면 지나간 날에 붙고
**고객은 영영 보지 못합니다.** 060 이 `journey_current_day()` 로 앱과 같은 계산을 씁니다.
앱 쪽을 고치면 이 함수도 같이 고쳐야 합니다.

검증: `npm run verify:professional` (DB 24건) + `npm run verify:professional-api` (HTTP 61건).

### 전문가 계정 발급

앱에서 스스로 전문가가 될 수 없습니다. 이미 **가입된 계정**의 역할을 관리자가 올립니다.

```bash
curl -X POST "$BASE/api/admin/professionals" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"trainer@example.com","type":"PERSONAL_TRAINER","displayName":"김트레이너"}'
```


트레이너·물리치료사가 고객 Plan 을 관리하는 확장의 **기반 계층**입니다.
설계는 `docs/MEBODY_PROFESSIONAL_ARCHITECTURE.md` 와 `docs/MEBODY_PROFESSIONAL_ROADMAP.md` 에 있습니다.

- `professionals` 전문가. `user_profiles` 와 1:1
- `professional_clients` 전문가 ↔ 고객. **초대와 관계가 한 행**입니다
- `current_professional_id()` RLS 헬퍼. `current_seller_id()` 와 같은 모양
- `get_client_response(client_user_id)` 전문가가 고객 결과를 읽는 **유일한 통로**

`questionnaire_responses` 의 정책은 건드리지 않았습니다. 넓히면 044 를 되돌리는 셈입니다.
전문가 열람은 함수 하나로만 나가고, 관계가 `ACTIVE` 이며 고객이 동의했을 때만 1행이 나옵니다.
아니면 오류가 아니라 **0행**입니다. 오류가 갈리면 관계 여부를 떠볼 수 있습니다.

화면과 API 는 아직 없습니다. Phase 1 에서 서버 관리자 콘솔에 탭으로 붙입니다.

## 적립금 (`db/journey/057`, `058`, `065`, `066`, `067`)

무료 적립은 **한 달 49원**을 넘지 않습니다. 평균은 42원입니다.

### 눈과 금액을 분리한 이유

예전에는 주사위 눈이 곧 원이었습니다(6눈=6원). 금액만 깎으면 "6" 을 띄우고 2원을 주게 되어
눈이 아무 뜻도 없어집니다. 그래서 눈은 그대로 1~6 이 **고르게** 나오게 두고, 눈마다 얼마인지는
`reward_rules.payout` 표가 정합니다. 6이 나오면 실제로 제일 좋은 결과입니다.

| 규칙 | 눈 → 원 | 평균/월 |
|---|---|---|
| 매일 루틴 주사위 | 1·2·3·4눈 → 0원 · 5눈 → 1원 · 6눈 → 2원 | 15원 |
| 보너스 주사위 | 1~5눈 → 0원 · 6눈 → 1원 | 5원 |
| 매일 미션 | 0원 75% · 1원 22% · 2원 3% | 8원 |
| 주간 2원 · 월간 3원 · 14일 완주 3원 | 고정 | 14원 |

**줄 수 없는 금액을 암시하지 않습니다.** `reward_rules.max_amount` 는 payout 표의 실제 최대와
같아야 하고, `verify:routine-reward` 가 그걸 검사합니다. 받을 수 없는 숫자를 적어 두면 그게 곧 과장입니다.

### 상한은 트리거가 보증합니다

청구 함수 여섯 개를 각각 고치면 언젠가 하나를 빠뜨립니다. `user_rewards` 의 BEFORE INSERT
트리거(`enforce_reward_monthly_cap`)가 남은 한도만큼만 통과시킵니다. 검증에서 청구 함수를 거치지
않고 25원을 직접 넣어도 **19원만**(남은 한도) 들어갑니다.

- **구매 적립은 상한 밖입니다.** 돈을 쓴 것에 대한 환원이지 공짜로 주는 것이 아닙니다.
- **꽝(0원)도 행으로 남깁니다.** 남기지 않으면 "오늘 이미 굴렸다" 를 판정할 수 없어 꽝인 날은
  몇 번이고 다시 굴릴 수 있게 됩니다. 그래서 `amount <> 0` 제약을 풀었습니다.
- **상한을 화면에 보여줍니다.** 마이페이지에 「이번 달 12 / 49원」. 숨기면 한도에 닿은 뒤의 0원이
  "운이 나빴다" 로 보이는데 그건 사실이 아닙니다.
- **남의 적립액은 못 봅니다.** `reward_earned_this_month(uuid)` 는 서버 전용이고, 회원에게는
  인자 없는 `my_reward_month_status()` 만 엽니다.

### 적립 경로는 여러 개입니다 — 규칙을 바꾸면 전부 찾아야 합니다

같은 `rule_code` 를 여러 함수가 씁니다. 057 에서 청구 함수 세 개를 눈→금액 표로 바꿨는데
**네 번째(`grant_routine_bonus_admin`, AdMob SSV)를 빠뜨려서** 같은 보너스가 앱에서는 1원,
SSV 에서는 6원이 되는 상태였습니다(067 에서 고침).

`verify:reward-cap` 이 이제 자동으로 잡습니다 — payout 표가 있는 규칙을 쓰면서
`reward_payout_for` 를 부르지 않는 함수가 있으면 실패합니다.

### 상한 트리거는 memo 를 깨뜨리면 안 됩니다

057 의 트리거가 금액을 깎을 때 memo 에 평문을 덧붙였습니다. 그런데 주사위 적립의 memo 는
JSON 이고, 청구 함수가 "이미 받은 날" 을 판정할 때 그걸 `::jsonb` 로 읽습니다.
**상한에 닿은 사람이 다음에 주사위를 굴리면 그 자리에서 실패했습니다.**
065 에서 JSON 이면 키로 넣고, 아니면 평문을 붙이도록 고쳤습니다.

### 옛 마이그레이션을 재적용할 때 — **번호순으로 이어 붙입니다**

`033`·`036`·`037`·`042`·`046` 은 트랜잭션 안에서 재적용해 검증하는 파일들입니다. 그런데 이들은
`user_rewards_sign_check` 를 "적립은 amount > 0" 으로 되돌리고, 적립 규칙·고지·함수도 옛 값으로
덮습니다. **그 파일만 재적용하면 운영과 다른 상태를 검사하게 됩니다.**

그래서 각 스위트는 그 뒤 파일까지 **번호순으로** 이어 붙입니다. 순서가 중요합니다 —
057 이 고지를 새로 쓰고 063·066 이 거기 빠진 문장을 되살리므로, 거꾸로 붙이면 057 이 이깁니다
(실제로 그 실수를 했습니다).

| 스위트 | 재적용하는 옛 파일 | 이어 붙이는 것 |
|---|---|---|
| `verify:routine-reward` | 033 | 057 · 063 · 065 · 066 · 067 |
| `verify:routine-bonus` | 036 | 057 · 063 · 065 · 066 · 067 |
| `verify:redesign` | 037 | 057 · 063 · 065 · 066 · 067 |
| `verify:fulfillment` | 042 | 057 · 063 · 065 · 066 · 067 |
| `verify:account-deletion` | 046 | 064 |

검증: `npm run verify:reward-cap` (20건) · `verify:routine-reward` (28건) · `verify:e2e` (41건).

## 운영 지표 (`db/journey/054`, `068`)

콘솔의 **「지표」 탭**(관리자 전용)에서 네 퍼널을 봅니다. 이벤트를 쌓아도 볼 곳이 없으면
쌓는 의미가 없습니다 — 로드맵의 각 Phase 에는 "이 비율이 얼마 미만이면 멈춘다" 는 실패
조건이 있고, 그 숫자를 볼 화면이 여기입니다.

| 퍼널 | 칸 |
|---|---|
| 진단 | 랜딩 → 문항 시작 → 문항 완료 → 결과 확인 |
| 저니 | 결과 확인 → 루틴 시작 → 오늘 화면 → 미션 시작 → 미션 완료 → 피드백 → 주간 리포트 → 다음 루틴 |
| 수익 | 멤버십 화면 → 결제 누름 → 구독 시작 |
| 전문가 | 초대 발송 → 링크 열림 → 고객 동의 → 결과 열람 → 수행 기록 → 미션 배정 |

### 화면이 지키는 두 가지

- **비율은 바로 앞 칸 대비**입니다. 첫 칸 대비로 그리면 뒤로 갈수록 다 같이 작아져서
  어느 칸이 문제인지 안 보입니다. 앞 칸의 절반 아래로 떨어지는 칸은 붉게 표시합니다.
- **앞 칸이 0이면 `—`** 입니다. 0으로 나눈 값을 0% 로 적으면 "아무도 안 넘어갔다" 로 읽히는데,
  사실은 "잴 수 없다" 입니다.

### 어디서 읽는가 — 두 곳을 섞지 않습니다

| 출처 | 무엇 | 왜 |
|---|---|---|
| `analytics_events` | 앱에서 쏘는 이벤트 | 개인 식별 값을 일부러 넣지 않습니다(054) |
| `professional_activity_log` | 전문가별 활동 | "주간 활성 전문가" 는 전문가를 구분해야 셉니다(056·068) |

전문가 퍼널은 두 곳에 걸쳐 있습니다 — 초대 발송·결과 열람은 전문가 로그에, 링크 열기·동의는
앱 이벤트에 있습니다. 초대 생성과 발송 기록은 **한 트랜잭션**입니다(`create_client_invite()`).
서버가 따로 INSERT 하면 한쪽만 성공하는 순간이 생기고, 그러면 지표가 조용히 어긋납니다.

### 이벤트를 더할 때 조심할 것

- **화면 진입 이벤트는 한 번만** 남깁니다. 다시 그려질 때마다 쌓으면 비율이 부풀어 오릅니다
  (`journey_viewed` 는 일차당 한 번).
- **저장이 끝난 뒤에** 남깁니다. 실패한 시도를 세면 비율이 실제보다 높아집니다
  (`feedback_submitted`).
- **시도와 성공을 나눕니다.** 둘의 차이가 실패율입니다 (`checkout_clicked` vs `subscription_started`).

`day_2/7/14_return`(리텐션)은 아직 없습니다. 14일 알림과 같이 가야 하는 항목이라
지금 넣으면 반쪽입니다.

### 화면 확인용 가상 데이터

```bash
npm run seed:analytics            # 30일치 가상 퍼널
npm run seed:analytics -- --clean # 가상 이벤트만 삭제
```

넣는 행마다 `props.demo = true` 를 찍어 **실제 사용자 이벤트는 건드리지 않습니다.**
숫자는 아무렇게나 넣지 않았습니다 — 앞뒤가 안 맞는 가상 자료는 판단을 돕는 게 아니라 흐립니다
(처음에 전문가 퍼널을 따로 만들었더니 "동의 2명인데 결과 32번 열람" 으로 **1600%** 가 찍혔습니다).

검증: `npm run verify:metrics` (25건).

## 결과 공유

`부분 구현` — 링크 복사와 OS 공유는 동작하고, 카카오톡 공유는 키를 발급받으면 켜집니다.

- 공유 링크: `https://<도메인>/?ref=share&code=FRRS`
- 링크에 담는 값은 **몸BTI 코드뿐입니다.** `result id` 는 넣지 않습니다.
  id 가 링크에 실리면 받은 사람이 조회 RPC 로 원 사용자의 32문항 응답을 열 수 있습니다.
- `code` 는 결과 복원용이 아니라 랜딩 문구("친구의 몸BTI는 FRRS 였어요") 재료입니다.
  링크로 들어온 사람은 자기 진단을 처음부터 새로 합니다.
- 공유 파라미터는 첫 진입에서 한 번 읽고 URL 에서 지웁니다(`flowUrl`).
- 카카오 피드 이미지는 `public/og-image.png`(1200×630)를 씁니다. 캐릭터 PNG 는 세로 비율이라 잘립니다.
- 이벤트 기록은 `src/lib/analytics.ts` 의 `track()` 인터페이스만 있습니다. 외부 분석 SDK 는 아직 붙이지 않았습니다.
  payload 에는 `body_code`·`share_channel`·`ref` 만 넣습니다.

사람이 해야 하는 준비: Kakao Developers 앱 생성 → JavaScript 키 발급 →
플랫폼 Web 에 도메인 등록 → 카카오톡 공유 활성화 → `VITE_KAKAO_JAVASCRIPT_KEY` 설정.

## 법적 문서

`public/{privacy,terms}.html` 과 `mebody-server/src/main/resources/static/{privacy,terms}.html`
**네 파일이 같은 내용입니다.** 고칠 때 넷을 같이 고쳐야 어긋나지 않습니다.

플레이스홀더를 걷어내고 실제 문장으로 바꿨습니다. 코드에서 확인한 것만 적었습니다.
수집 항목, 보유 기간, 파기 절차는 이번에 만든 탈퇴 동작과 일치시켰습니다.

**아직 빈칸입니다.** 노란 표시로 본문에 드러나 있습니다.
개인정보처리방침 7곳, 이용약관 6곳입니다.

| 채워야 하는 것 |
|---|
| 시행일 · 개정일 |
| 사업자등록번호 |
| 통신판매업 신고번호 |
| 주소 |
| 개인정보 보호책임자 성명 / 직책 |
| 문의 이메일 |
| 전화번호 |

상호 (주)mebody 와 대표자 최우혁은 채워져 있습니다.
**배포 전 법무 검토가 필요합니다.** 이 문서는 검토받을 초안입니다.

## 진단 응답 접근 정책 (`db/journey/044`, `045`)

적용 전에는 `questionnaire_responses` 의 조회 정책이 `user_id IS NULL` 이라
**익명·로그인 사용자 모두 남의 비회원 결과 381건을 id 없이 읽을 수 있었습니다.**

- 읽기: `get_questionnaire_response(p_id)` RPC 한 곳으로만 나갑니다. id 를 알아야 한 행이 나오고 `user_id` 는 돌려주지 않습니다.
- 쓰기: `save_questionnaire_response(...)` RPC 로 저장합니다.
  `UPDATE ... WHERE id = ?` 는 WHERE 절이 컬럼을 읽어 SELECT 권한을 함께 요구하므로,
  읽기 권한만 회수하면 비회원 저장이 깨집니다. 그래서 쓰기도 함께 옮겼습니다.
- 로그인 직후 비회원 결과 귀속은 `claim_questionnaire_response(p_id)` 가 맡습니다(익명은 실행 불가).
- 앱은 RPC 가 없으면 예전 테이블 경로로 폴백하므로 SQL 적용과 앱 배포 순서는 상관없습니다.

045 는 여기에 하나를 더 얹습니다. **제출이 끝난 결과(`status='completed'`)는 더 이상 바뀌지 않습니다.**
결과 id 는 주소창(`?result=...`)에 보이므로 언젠가는 샙니다. 044 만으로는 id 를 아는 사람이
저장 RPC 로 남의 코드와 32문항 답변을 통째로 덮어쓸 수 있었습니다(운영에서 실측했습니다).
같은 결과를 다시 보내는 요청은 오류 대신 조용히 통과시킵니다. 저장 실패로 판단한 앱의 재시도와
제출 직후 늦게 도착하는 임시저장이 그 경로입니다. 재측정은 새 id 로 새 행을 만들므로 영향이 없습니다.

id 가 새면 **읽기는 여전히 됩니다.** id 자체가 자기 결과를 여는 열쇠라서 그렇습니다.
다만 공유 링크에는 id 가 없고, 앱은 자기 세션에서 만든 결과가 아니면 화면을 열지 않고 랜딩으로 보냅니다.

## 주요 파일

- `src/App.tsx`: 화면 전환, 결과 저장 상태, 로그인 후 분기
- `src/api/questionnaire.ts`: `mebody_v1_32` 문항 조회·검증, 응답 저장, 결과 조회
- `src/api/account.ts`: 프로필, 최신 결과, 멤버십 조회
- `src/api/content.ts`: 콘텐츠, 이미지, Ver6 액션 데이터 조회
- `src/utils/bodyCodeCalculator.ts`: 32문항 기반 4축 mebody 코드와 아이덴티티 계산
- `src/data/v1QuestionsSnapshot.ts`: 즉시 렌더링용 32문항 스냅샷
- `src/utils/characterImages.ts`: Supabase Storage 우선 캐릭터 이미지 해석
- `src/lib/share.ts`: 공유 링크·문구 조립, OS 공유, 링크 복사
- `src/lib/kakao.ts`: 카카오 SDK 지연 로드와 피드 공유(키가 있을 때만)
- `src/lib/analytics.ts`: 이벤트 기록 인터페이스(외부 SDK 없음)
- `src/api/rpcSupport.ts`: 마이그레이션 적용 전 DB 에서 RPC 폴백 판별
- `src/api/signup.ts`: 회원가입 요청(서버 경유, 서버 없으면 이메일만 폴백)
- `src/lib/identifier.ts`: 이메일·휴대폰 판별과 별칭 이메일 변환
- `src/api/accountDeletion.ts`: 탈퇴 요청(서버 경유)
- `src/components/status/StatusScreen.tsx`: 내 상태. 탈퇴와 불러오기 실패 표시

## 변경 시 검증 체크리스트

- 서버를 끄고도 모바일 앱 첫 문항과 결과 흐름이 동작하는지 확인합니다.
- Supabase active questions가 `question_set=mebody_v1_32`, `total=32`, `precheck=0`, `scored=32`인지 확인합니다.
- 32문항 완료 후 바로 분석 화면으로 이동하는지 확인합니다.
- 저장 실패 상황에서도 결과 화면이 막히지 않는지 확인합니다.
- 같은 회원이 다시 진단하면 랜딩, 마이페이지, 코드 플랜과 관리자 화면이 최신 완료 코드 기준으로 표시되는지 확인합니다.
- 홈페이지 `/` → `/sample` → Google Forms 흐름이 유지되는지 확인합니다.
- 설정된 Railway 배포 주소의 `/`, `/sample`, `/api/public/config`, `/api/public/health` 가 정상 응답하는지 확인합니다.
  `{"message":"Application not found"}` 가 오면 우리 서버가 아니라 **Railway 엣지**가 내는 404 입니다 — 그 주소에 배포본이 없는 것입니다.
- 홈페이지와 간이 결과에 Vercel 모바일 앱 CTA를 추가했다면 이 README의 연결 상태도 함께 갱신합니다.
- 결과 이후 비즈니스 모델이 결정되면 `미정` 항목과 구현 상태를 함께 갱신합니다.
- 앱 문구의 문항 수와 `정밀 체크` 표현이 현재 정책과 일치하는지 확인합니다.
- 비회원이 32문항을 완주해 결과가 저장·표시되는지 확인합니다(응답 저장 경로를 바꾸면 가장 먼저 깨집니다).
- 공유 링크에 `result` 파라미터가 섞여 있지 않은지 확인합니다.
- 카카오 키가 없을 때 카카오 버튼이 숨고 나머지 공유가 동작하는지 확인합니다.
- 이메일 가입은 확인 메일을 열기 전까지 로그인이 막히고, 휴대폰 가입은 즉시 로그인되는지 확인합니다
  (`npm run verify:signup` — 서버 설정을 읽어 모드에 맞게 검사합니다).
- 확인 메일이 **실제로 도착하는지**를 본인 주소로 한 번 확인합니다. Supabase 기본 SMTP 는 시간당
  몇 통이라 연속 가입이 `429` 로 막힙니다. 외부 가입자를 받기 전에 자체 SMTP 를 붙입니다.
- 비밀번호 길이 제한을 올렸다면 앱의 오류 문구가 그 길이를 그대로 보여주는지 확인합니다.
- 홈페이지(`/`)의 회원가입도 확인 메일 없이 바로 로그인되는지 확인합니다.
- 승인 대기 상태의 계정이 로그인 한 번으로 풀리는지 확인합니다.
- 휴대폰 가입에 복구용 이메일을 적고, 로그아웃 뒤 번호로 다시 로그인되는지 확인합니다.
- 탈퇴 뒤 주문·결제가 남고 구매자 연결만 끊기는지 확인합니다(`npm run verify:account-deletion`).
- 적립금 조회를 일부러 실패시켰을 때 0원이 아니라 오류로 표시되는지 확인합니다.
- 전문가가 자기 고객 밖의 결과를 못 보는지 확인합니다(`npm run verify:professional`).
- 이벤트가 실제로 쌓이고 익명이 읽지 못하는지 확인합니다(`npm run verify:analytics`).
- 결과 화면의 축 게이지 아래에 "내 답변 기준" 근거가 뜨는지 확인합니다.
- 휴대폰으로 가입한 계정이 로그아웃 뒤 같은 번호로 다시 로그인되는지 확인합니다.
- 공개 승인(`/api/public/auth/approve`)이 확인 절차를 우회시키지 않는지 확인합니다
  (`npm run verify:approve-guard` — 확인 절차를 켠 서버에 대고도 한 번 돌립니다).
- APK 를 만들기 전에 API base 가 배포 주소인지 확인합니다(`npm run env:check` — `app:build`·`app:apk` 가 자동으로 부릅니다).
- 전문가가 동의하지 않은 고객의 결과·수행 기록을 못 보는지 확인합니다(`npm run verify:professional-api`).
- 전문가에게 보여주는 범위를 넓혔다면 **동의 화면 문구부터** 고칩니다
  (`ProfessionalConsentScreen.tsx`). 문구를 두고 범위만 넓히면 받지 않은 동의를 쓰는 것입니다.
- 고객이 동의를 거두면 그 순간부터 전문가 화면이 404 가 되는지 확인합니다.
- 결과 화면이 실제로 그려지는지 확인합니다 — `HomeScreen` 에 훅을 더할 때는 **조기 return 위**에
  두어야 합니다. 아래에 두면 로딩 렌더와 완료 렌더의 훅 개수가 달라져 화면이 통째로 죽습니다.
- **테이블을 지우기 전에 DB 함수·뷰·트리거까지 훑습니다.** 코드만 보면 놓칩니다 —
  `body_bti_results` 를 지웠을 때 `prepare_account_deletion()` 이 부러져 탈퇴가 503 이 됐습니다.
  `npm run verify:migrations` 가 이제 자동으로 잡습니다.
- 적립 규칙을 바꿨다면 **같은 rule_code 를 쓰는 함수를 전부** 찾습니다
  (`npm run verify:reward-cap` 이 payout 표를 거치지 않는 경로를 잡습니다).
- 옛 마이그레이션을 재적용해 검증하는 스위트는 **그 뒤 파일까지 번호순으로** 이어 붙입니다.
- 광고 단위를 바꿨다면 `npm run ads:check` 로 앱 ID(`~`)와 단위 ID(`/`)를 혼동하지 않았는지 확인합니다.
