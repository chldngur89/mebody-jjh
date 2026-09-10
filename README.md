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

로컬에서 서버와 같이 테스트할 때만 `VITE_API_BASE_URL=http://localhost:8081`으로 변경합니다.

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

### 지금 상태 — 조건 없이 가입

이메일이든 휴대폰이든, 값 두 개만 넣으면 그 자리에서 가입되고 로그인 상태가 됩니다.

| 항목 | 지금 | 다시 거는 방법 |
|---|---|---|
| 이메일 확인 메일 | 없음 | `MEBODY_AUTH_REQUIRE_EMAIL_VERIFICATION=true` |
| 휴대폰 인증번호 | 없음 | SMS 제공자 연결 후 `MEBODY_AUTH_REQUIRE_PHONE_VERIFICATION=true` |
| 비밀번호 길이 | 1자 (사실상 제한 없음) | `MEBODY_AUTH_MIN_PASSWORD_LENGTH=8` |
| 비밀번호 확인 칸 | 없앰(앱·홈페이지 둘 다) | `AuthScreen.tsx` 와 `static/index.html` 에 다시 넣어야 함 |
| 승인 대기 계정 | 로그인할 때 자동으로 풀림 | 확인 절차를 켜면 닫힘 |
| 이름 | 선택 | — |
| 이메일/휴대폰 선택 | 입력하는 대로 자동 판별 | — |

막는 것은 계정을 만들 수 없는 입력뿐입니다. 빈 값, 그리고 이메일도 번호도 아닌 값입니다.
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
`MEBODY_AUTH_REQUIRE_EMAIL_VERIFICATION=true` 로 확인 절차를 켜면 이 경로는 저절로 닫힙니다.

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

### 사람이 해야 하는 것 (휴대폰 인증을 켤 때)

1. Supabase → Authentication → Providers → Phone 활성화, Twilio 등 SMS 제공자 연결
2. `MEBODY_AUTH_PHONE_MODE=native`, `MEBODY_AUTH_REQUIRE_PHONE_VERIFICATION=true`
3. 기존 별칭 계정을 번호 계정으로 옮기는 이전 작업 (별칭 계정에 이미 번호가 들어 있습니다)

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

## 변경 시 검증 체크리스트

- 서버를 끄고도 모바일 앱 첫 문항과 결과 흐름이 동작하는지 확인합니다.
- Supabase active questions가 `question_set=mebody_v1_32`, `total=32`, `precheck=0`, `scored=32`인지 확인합니다.
- 32문항 완료 후 바로 분석 화면으로 이동하는지 확인합니다.
- 저장 실패 상황에서도 결과 화면이 막히지 않는지 확인합니다.
- 같은 회원이 다시 진단하면 랜딩, 마이페이지, 코드 플랜과 관리자 화면이 최신 완료 코드 기준으로 표시되는지 확인합니다.
- 홈페이지 `/` → `/sample` → Google Forms 흐름이 유지되는지 확인합니다.
- 설정된 Railway 배포 주소의 `/`, `/sample`, `/api/public/config`가 정상 응답하는지 확인합니다.
- 홈페이지와 간이 결과에 Vercel 모바일 앱 CTA를 추가했다면 이 README의 연결 상태도 함께 갱신합니다.
- 결과 이후 비즈니스 모델이 결정되면 `미정` 항목과 구현 상태를 함께 갱신합니다.
- 앱 문구의 문항 수와 `정밀 체크` 표현이 현재 정책과 일치하는지 확인합니다.
- 비회원이 32문항을 완주해 결과가 저장·표시되는지 확인합니다(응답 저장 경로를 바꾸면 가장 먼저 깨집니다).
- 공유 링크에 `result` 파라미터가 섞여 있지 않은지 확인합니다.
- 카카오 키가 없을 때 카카오 버튼이 숨고 나머지 공유가 동작하는지 확인합니다.
- 이메일·휴대폰으로 가입한 직후 바로 로그인 상태가 되는지 확인합니다(`npm run verify:signup`).
- 비밀번호 길이 제한을 올렸다면 앱의 오류 문구가 그 길이를 그대로 보여주는지 확인합니다.
- 홈페이지(`/`)의 회원가입도 확인 메일 없이 바로 로그인되는지 확인합니다.
- 승인 대기 상태의 계정이 로그인 한 번으로 풀리는지 확인합니다.
- 휴대폰으로 가입한 계정이 로그아웃 뒤 같은 번호로 다시 로그인되는지 확인합니다.
