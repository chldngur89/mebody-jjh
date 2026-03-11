# mebody - 개발 로드맵

## 🔄 2026-03-09 최신 TODO (실행 우선순위 재정렬)

### P0. 결제/회원/재방문 안정화 (즉시)
- [ ] 실제 결제 연동(Stripe/Toss) + 서버(Webhook) 검증으로 `activateSubscription` 테스트 로직 교체
- [ ] 인증 UX 보완(비밀번호 재설정, 이메일 인증 재전송, 인증 실패 메시지 표준화)
- [ ] 마이페이지(내 결과 히스토리) 추가: 최근 결과/이전 결과/재방문 빠른 진입
- [ ] RLS/권한 점검: `questionnaire_responses`, `user_profiles`, `user_subscriptions`

### P0. Ver3 문서 반영 1차 (무료 결과 + 잠금 태그 + 회원 전환)
- [x] 결과 페이지 4번 섹션에 `심화 태그 미리보기` 블록 추가 (잠금 아이콘 + 설명 + CTA)
- [x] 비회원: `회원가입 후 내 mebody 코드 더 알아보기` 유도
- [x] 회원: 심화 태그 안내 화면 진입
- [ ] 회원: 태그별 실제 추가 3문항 진입
- [x] 40문항만으로 즉시 확정 가능한 태그 엔진 1차 구현
  - [x] Borderline
  - [x] Low confidence
  - [x] 3-axis borderline
  - [x] Mixed
  - [x] Zig-zag Compensation

### P1. Ver3 문서 반영 2차 (심화 3문항 확정 플로우)
- [x] 심화 태그 후보 감지 로직 구현 (문서 기준 기본 감지 조건)
  - [x] Sitting-driven
  - [x] Work-dominant
  - [x] Compensatory neck
  - [x] Ankle-limited
  - [x] Hip-rotation asymmetry
  - [x] Anterior-leaning strategy
  - [x] Posterior-leaning strategy
  - [x] Global-stiff strategy (충돌 해결 포함)
- [ ] Low confidence 케이스 A 적용: 1~2축 저신뢰 시 부분 재평가 유도
- [ ] Low confidence 케이스 B 적용: 3~4축 저신뢰 시 16코드 발급 중단 + Full Retest 화면
- [ ] 태그별 추가 3문항 UI/저장/확정 플로우 구현
- [ ] 심화 결과 페이지(확정 태그 + 루틴 우선순위 + 설명 강화) 구현

### P1. Ver3 데이터 모델/SQL (Supabase, 최소 구조)
- [ ] `questionnaire_responses`에 심화 상태 컬럼 추가 (`deep_status`)
- [ ] `questionnaire_responses`에 심화 태그 JSON 컬럼 추가 (`advanced_preview_tags`, `advanced_confirmed_tags`)
- [ ] `questionnaire_responses`에 심화 답변 JSON 컬럼 추가 (`advanced_followup_answers`)
- [ ] 심화 3문항 정의는 기존 `app_content`의 JSON 키로 관리 (`advanced_tag_followups`)
- [ ] 현재 프론트 저장 로직을 실제 Supabase 컬럼 적용 후 검증

### P1. 문서/운영 정비
- [ ] `TODO.md` 기존 항목과 현재 구현 상태 동기화 (이미 완료된 로그인/멤버십/결제 UI 반영)
- [ ] Ver3 기준 용어 통일: 문서는 현재 `13개 태그` 기준이며, 일부 파일명/슬라이드의 `11개` 표현 정리 필요
- [ ] QA 체크리스트 작성: 비회원/회원/결제상태/재방문/심화문항 분기 테스트

---

## ✅ 완료된 작업 (v1.0)

### Foundation (기반 구축)
- [x] React 18 + TypeScript + Tailwind CSS 프로젝트 설정
- [x] Vite 빌드 도구 구성
- [x] Radix UI 컴포넌트 설치

### Database (데이터베이스)
- [x] Supabase 프로젝트 생성
- [x] questions 테이블 - 40문항 데이터
- [x] questionnaire_responses 테이블 - 응답 저장
- [x] body_code_content 테이블 - 16개 체형 콘텐츠
- [x] RLS 정책 설정 (익명 접근 허용)

### Core Features (핵심 기능)
- [x] 랜딩 페이지 (LandingScreen)
- [x] 진단 소개 화면 (DiagnosisIntroScreen)
- [x] 40문항 설문 화면 (QuestionnaireScreen)
  - [x] DB에서 질문 동적 로드
  - [x] 자동 저장 (3초 디바운스)
  - [x] 진행률 계산
- [x] 분석 중 화면 (AnalyzingScreen)
- [x] 결과 페이지 (ResultScreen)
  - [x] 체형 코드 계산 로직
  - [x] 16개 캐릭터 이미지 연동
  - [x] 캐릭터 이름 표시
  - [x] 4축 분석 결과
  - [x] 체형 특징 칩
  - [x] 16개 체형 그리드

### Deployment (배포)
- [x] Vercel 프로젝트 연결
- [x] 환경변수 설정 (Supabase)
- [x] 빌드 최적화 (dist 폴더)
- [x] Vercel 배포 완료

### PWA (프로그레시브 웹 앱)
- [x] vite-plugin-pwa 설치 및 설정
- [x] manifest.json 생성
- [x] Service Worker (오프라인 지원)
- [x] Workbox 캐싱 구성
- [x] 모바일 최적화 메타 태그
- [x] 앱 아이콘 (icon.svg)

### Documentation (문서화)
- [x] README.md 작성
- [x] supabase-schema.sql (DB 스키마)
- [x] insert-questions.sql (40문항)
- [x] insert-body-codes.sql (16개 체형)
- [x] update-character-names.sql (캐릭터 이름)

---

## 🎯 v1.1 - 사용자 경험 향상 (높은 우선순위)

### 1. 결과 공유 기능 [높음]
**预估 시간: 3시간**

- [ ] URL 파라미터로 결과 공유
  ```
  mebody.com/result?id=uuid
  ```
- [ ] 소셜 미디어 공유 버튼 (카카오톡, 트위터, 페이스북)
- [ ] 링크 복사 기능
- [ ] QR 코드 생성 (선택)

**파일:**
- `src/utils/share.ts` - 공유 유틸리티
- `src/components/ShareButton.tsx` - 공유 버튼 컴포넌트

### 2. 결과 다운로드 [높음]
**预估 시간: 4시간**

- [ ] HTML → Canvas → PNG 변환
- [ ] html2canvas 라이브러리 설치
- [ ] 다운로드 버튼 구현
- [ ] 파일명 자동 생성 (예: `mebody-FLRF-2024-02-09.png`)

**파일:**
- `src/utils/download.ts` - 다운로드 유틸리티
- `src/components/DownloadButton.tsx` - 다운로드 버튼

**의존성:**
```bash
npm install html2canvas
```

### 3. 구독 전환 UI [중간]
**预估 시간: 6시간**

- [ ] 구독 플랜 화면 컴포넌트
- [ ] 월간/연간 요금제 선택
- [ ] Supabase Payment 연동 (선택)
- [ ] "전체 프로그램 시작하기" 버튼 클릭 시 구독 페이지 이동

**파일:**
- `src/components/SubscriptionScreen.tsx` - 구독 화면
- `src/components/PricingCard.tsx` - 요금제 카드

---

## 🎯 v1.2 - 콘텐츠 확장 (중간 우선순위)

### 4. 운동 영상 연동 [중간]
**预估 시간: 8시간**

- [ ] 유튜브 임베드 연동
- [x] 각 체형별 영상 URL 저장 (body_code_content 테이블)
- [ ] 영상 플레이어 컴포넌트
- [ ] 인스타그램 릴스/틱톡 연동 (선택)

**DB 업데이트:**
```sql
ALTER TABLE body_code_content ADD COLUMN exercises_video_urls JSONB;
```

**파일:**
- `src/components/VideoPlayer.tsx` - 영상 플레이어
- `src/components/ExerciseVideoCard.tsx` - 영상 카드

### 5. 헬스 용품 추천 페이지 [중간]
**预估 시간: 6시간**

- [ ] 헬스 용품 데이터베이스 확장
- [ ] 각 체형별 추천 용품
- [ ] 구매 링크 (네이버 쇼핑, 쿠팡 제휴)
- [ ] 용품 상세 페이지

**파일:**
- `src/components/ProductsScreen.tsx` - 용품 목록
- `src/components/ProductCard.tsx` - 용품 카드

### 6. 상세 운동 루틴 [낮음]
**预估 시간: 10시간**

- [x] 현재: 간단한 운동 목록
- [ ] 상세 루틴 페이지
- [ ] 세트/회수/시간 표시
- [ ] 진행 체크박스
- [ ] 완료 기록 저장

---

## 🎯 v1.3 - 사용자 시스템 (로그인/회원가입)

### 7. 인증 시스템 [중간]
**预估 시간: 12시간**

- [x] Supabase Auth 설정
- [ ] 로그인 화면
- [ ] 회원가입 화면
- [ ] 소셜 로그인 (구글, 애플)
- [ ] 비밀번호 찾기

**파일:**
- `src/components/LoginScreen.tsx` - 로그인
- `src/components/SignupScreen.tsx` - 회원가입
- `src/lib/auth.ts` - 인증 유틸리티

### 8. 내 설문 내역 [중간]
**预估 시간: 8시간**

- [ ] 마이페이지 화면
- [ ] 이전 결과 목록
- [ ] 결과 상세 보기
- [ ] 결과 비교 기능 (과거 vs 현재)

**파일:**
- `src/components/MyPageScreen.tsx` - 마이페이지
- `src/components/HistoryCard.tsx` - 이력 카드

### 9. 즐겨찾기/북마크 [낮음]
**预估 시간: 6시간**

- [ ] favorite_exercises 테이블
- [ ] 운동 북마크 기능
- [ ] 북마크 목록 페이지

---

## 🎯 v2.0 - 고급 기능 (장기 계획)

### 10. 푸시 알림
**预估 시간: 8시간**

- [ ] Firebase Cloud Messaging 연동
- [ ] 스트레칭 리마인더
- [ ] 결과 분석 알림

### 11. 커뮤니티 기능
**预估 시간: 20시간**

- [ ] 사용자 후기/평점
- [ ] 체형별 팁 공유
- [ ] Q&A 게시판

### 12. 오프라인 모드 강화
**预估 시간: 6시간**

- [ ] IndexedDB 연동
- [ ] 완전 오프라인 사용 가능
- [ ] 동기화 기능

### 13. 랭킹/도전 시스템
**预估 시간: 12시간**

- [ ] 체형 교정 목표 설정
- [ ] 일일/주간 도전 과제
- [ ] 성취 배지 (Achievement Badges)

---

## 📊 개발 우선순위 매트릭스

| 우선순위 | 기능 | 예상 시간 | 비즈니스 영향 |
|---------|------|----------|-------------|
| **P0** | 결과 공유 | 3시간 | 바이럴 효과 |
| **P0** | 결과 다운로드 | 4시간 | 바이럴 효과 |
| **P1** | 구독 전환 UI | 6시간 | **수익화** |
| **P1** | 운동 영상 | 8시간 | 콘텐츠 가치 |
| **P1** | 헬스 용품 | 6시간 | **수익화** |
| **P2** | 인증 시스템 | 12시간 | 리텐션 |
| **P2** | 내 설문 내역 | 8시간 | 리텐션 |
| **P3** | 푸시 알림 | 8시간 | 재방문 |
| **P3** | 커뮤니티 | 20시간 | 참여도 |

---

## 🛠️ 기술 부채 (Tech Debt)

### 즉시 해결 필요
- [ ] 이미지 최적화 (16개 PNG 파일 용량 줄이기)
  - 현재: 총 ~20MB
  - 목표: ~5MB (WebP 변환)
- [ ] 코드 스플리팅 (lazy loading)

### 점진적 개선
- [ ] 성능 모니터링 (Sentry)
- [ ] 분석 도구 (Google Analytics)
- [ ] 에러 로깅

---

## 📁 코드 구조 개선

### 제안 구조
```
src/
├── api/                      # API 함수들
│   ├── questionnaire.ts     # 설문 관련
│   ├── auth.ts             # 인증 관련 (v1.3)
│   └── share.ts            # 공유 관련 (v1.1)
├── components/
│   ├── screens/            # 화면 컴포넌트
│   │   ├── LandingScreen.tsx
│   │   ├── QuestionnaireScreen.tsx
│   │   └── ...
│   ├── shared/             # 공통 컴포넌트
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── Modal.tsx
│   └── ui/                 # 기본 UI (Radix 기반)
├── hooks/                   # 커스텀 훅
│   ├── useQuestionnaire.ts
│   └── useAuth.ts (v1.3)
├── lib/                    # 설정 및 유틸리티
├── store/                  # 상태 관리 (선택)
│   └── useAppStore.ts
└── types/                  # TypeScript 타입 정의
    └── index.ts
```

---

## 🚀 빠른 시작 체크리스트

### 새 기능 추가 시

1. [ ] 기능 정의서 작성
2. [ ] DB 스키마 변경 필요시 SQL 작성
3. [ ] API 함수 작성 (`src/api/*.ts`)
4. [ ] 컴포넌트 작성 (`src/components/screens/*.tsx`)
5. [ ] App.tsx에 라우트 추가
6. [ ] 타입 정의 (`src/types/*.ts`)
7. [ ] 테스트 작성 (선택)
8. [ ] 빌드 테스트
9. [ ] 코드 리뷰

---

## 📝 커밋 컨벤션

```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 업데이트
style: 코드 스타일 변경 (포맷팅, 세미콜론 등)
refactor: 코드 리팩토링
perf: 성능 개선
test: 테스트 추가/수정
chore: 빌드 설정, 도구 관련
```

**예시:**
```
feat: Add result sharing functionality
fix: Fix PWA offline mode caching issue
docs: Update README with new features
```

---

## 📞 지원 및 이슈 리포트

버그 리포트나 기능 요청은 GitHub Issues에 등록해주세요.

---

*마지막 업데이트: 2024년 2월*
*버전: v1.0*
