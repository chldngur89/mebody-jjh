# mebody - 체형 코드 기반 맞춤 운동 플랫폼

> 나만의 체형 코드를 발견하고, 과학적으로 검증된 맞춤 운동 프로그램을 받아보세요.

## 🎯 개요

**mebody**는 40문항의 간단한 자가진단을 통해 개인의 체형을 분석하고, 16가지 체형 분류 중 자신만의 코드를 부여하는 서비스입니다. 각 체형에 맞는 맞춤형 운동 루틴과 생활 습관 팁을 제공합니다.

### 핵심 기능

- **40문항 자가진단**: 목, 어깨, 골반, 하체 유연성 4가지 축을 측정
- **16가지 체형 분류**: 개인 맞춤 체형 코드 (예: FLRF, CRRS 등)
- **맞춤형 운동 프로그램**: 각 체형에 최적화된 운동 루틴
- **생활 습관 팁**: 일상에서 실천할 수 있는 자세 교정 팁
- **헬스 케어 용품 추천**: 체형에 맞는 보조 용품 제안

## 🏗️ 기술 스택

### 프론트엔드
- **React 18** - UI 라이브러리
- **TypeScript** - 타입 안전성
- **Tailwind CSS** - Utility-first 스타일링
- **Vite** - 빠른 빌드 도구
- **Radix UI** - 접근성优良的 UI 컴포넌트

### 백엔드
- **Supabase** - 데이터베이스 + 인증 (PostgreSQL)
- **Supabase Client** - 프론트엔드 연동

### 배포
- **Vercel** - 프론트엔드 호스팅

## 📁 프로젝트 구조

```
mebody/
├── src/
│   ├── api/
│   │   └── questionnaire.ts      # 설문 API 함수들
│   ├── components/
│   │   ├── LandingScreen.tsx    # 랜딩 페이지
│   │   ├── DiagnosisIntroScreen.tsx  # 진단 소개
│   │   ├── QuestionnaireScreen.tsx  # 40문항 설문
│   │   ├── AnalyzingScreen.tsx  # 분석 중 화면
│   │   └── ResultScreen.tsx      # 결과 페이지
│   ├── lib/
│   │   └── supabase.ts         # Supabase 클라이언트
│   ├── utils/
│   │   └── bodyCodeCalculator.ts  # 체형 코드 계산
│   └── App.tsx                 # 메인 앱 (화면 전환)
├── figma/                      # Figma 이미지 에셋
├── .env                        # 환경변수 (로컬)
├── .env.production             # 프로덕션 환경변수
├── vite.config.ts              # Vite 설정
├── vercel.json                 # Vercel 설정
└── package.json                # 의존성
```

## 🔧 설치 및 실행

### 1. 의존성 설치

```bash
cd mebody
npm install
```

### 2. 환경변수 설정

로컬 개발을 위해 `.env` 파일을 생성:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

### 4. 프로덕션 빌드

```bash
npm run build
```

`dist/` 폴더 생성 → Vercel에 배포

## 🎨 16가지 체형 코드

### 코드 구조 (4글자)

| 위치 | 의미 | 옵션 |
|------|------|------|
| **1번째 글자** | 목 위치 | F (전방/거북목), C (중앙) |
| **2번째 글자** | 어깨 높이 | L (왼쪽 높음), R (오른쪽 높음) |
| **3번째 글자** | 골반 회전 | L (왼쪽 회전), R (오른쪽 회전) |
| **4번째 글자** | 하체 유연성 | S (경직/뻣뻣함), F (유연) |

### 예시: FLRF

- **F** = 목이 앞으로 쏠림 (거북목)
- **L** = 왼쪽 어깨가 높음
- **R** = 오른쪽 골반이 앞으로 회전
- **F** = 하체가 유연함

### 캐릭터 예시

| 코드 | 캐릭터 이름 |
|------|-------------|
| FRRS | 암사가는 잠금 로봇 |
| FRRF | 기대면 흐르는 젤리인간 |
| FRLS | 되배기 금속 스프링 |
| FRLF | 회전 많은 풍선인형 |
| FLRS | 으쓱 고정 목각병정 |
| FLRF | 리듬은 좋은데 금방 시치는 갈대 |
| FLLS | 한쪽에 박힌 발톱 |
| FLLF | 녹아내리는 소프트콘 |
| CRRS | 닻 |
| CRRF | 오뚝이 |
| CRLS | 큐브 탑 |
| CRLF | 중심 귀찮은 문어 |
| CLRS | 엇갈려 잠긴 나무인형 |
| CLRF | 아슬아슬 젠가 탑 |
| CLLS | 한쪽 뿌리 소나무 |
| CLLF | 출렁이는 물침대 |

## 📊 데이터베이스 구조

### questions 테이블
40개 질문 데이터를 저장

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | SERIAL | 기본키 |
| question_number | INT | Q1 ~ Q40 |
| axis | VARCHAR | neck, shoulder, pelvis, flexibility |
| question_text | TEXT | 질문 내용 |
| option_1, 2, 3 | TEXT | 답변 옵션 |

### questionnaire_responses 테이블
사용자 응답 및 결과 저장

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | 기본키 |
| user_id | UUID | 사용자 ID |
| answers | JSONB | 응답 데이터 |
| calculated_code | VARCHAR | 계산된 체형 코드 |
| status | TEXT | draft, completed |

### body_code_content 테이블
16개 체형별 콘텐츠

| 컬럼 | 타입 | 설명 |
|------|------|------|
| body_code | VARCHAR | FLRF, CRRS 등 |
| character_name | TEXT | 캐릭터 이름 |
| exercises | JSONB | 운동 프로그램 |
| lifestyle_tips | JSONB | 생활 습관 팁 |
| health_products | JSONB | 헬스 용품 추천 |

## 🚀 배포

### Vercel 배포

1. Vercel Dashboard에서 프로젝트 연결
2. **Settings → Environment Variables**에 다음 추가:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. **Output Directory**: `dist`로 설정
4. Deploy 클릭

### Supabase 설정

1. 프로젝트 생성: https://supabase.com
2. SQL Editor에서 다음 실행:
   - `supabase-schema.sql` - 테이블 생성
   - `insert-questions.sql` - 40문항 데이터
   - `insert-body-codes.sql` - 16개 체형 콘텐츠
   - `update-character-names.sql` - 캐릭터 이름 업데이트

## 🛠️ 개발 가이드

### 새로운 기능 추가

1. **API 함수 추가**: `src/api/questionnaire.ts`에 함수 추가
2. **화면 컴포넌트**: `src/components/`에 새 파일 생성
3. **유틸리티**: `src/utils/`에 함수 추가

### 이미지 에셋 추가

Figma 이미지는 `src/components/figma/` 폴더에 추가:
- 개별 캐릭터: `{CODE}.png` (예: FLRF.png)
- 16개 전체: `bodyTypesImage.png`

## 📈 향후 개발 로드맵

### 단기 (높은 우선순위)
- 결과 공유 기능 (URL 공유)
- 결과 다운로드 (PNG/PDF)
- 구독 전환 UI

### 중기 (중간 우선순위)
- 운동 영상 연동 (유튜브 임베드)
- 헬스 용품 구매 페이지
- 사용자 인증 시스템 (Supabase Auth)
- 내 설문 내역

### 장기 (낮은 우선순위)
- 푸시 알림
- 커뮤니티 기능
- 오프라인 모드

## 📄 라이선스

MIT License

---

## 🙏 감사의 글

- **Figma**: 디자인 템플릿 제공
- **Supabase**: 데이터베이스 및 인증 인프라
- **Vercel**: 빠르고 무료로운 배포 환경
