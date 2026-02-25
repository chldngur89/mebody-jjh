# PPT/스펙 대비 현황 & TODO

우리가 만든 PPT(스펙)와 실제 구현 차이, 그리고 **가이드/자료가 DB에서 나오는지** 정리한 문서입니다.

---

## 1. 가이드·자료의 DB 연동 여부 (지금 상태)

| 화면 / 콘텐츠 | 출처 | DB 테이블 | 비고 |
|----------------|------|-----------|------|
| **진단 결과** – 캐릭터명, 설명, 운동·팁·용품 | **DB** | `body_code_content` | `fetchQuestionnaireResult`로 조회 후 ResultScreen에 표시 |
| **진단 결과** – 생체 정보 %, 4축 라벨, 키워드 | **계산** | (없음) | `getAxisScoreBreakdown`, `getAxisLabels`, `getBodyCodeKeywords` (코드에서 계산) |
| **진단 결과** – 캐릭터 이미지, 16가지 체형 이미지 | **DB 우선** | `app_images` | 있으면 DB, 실패 시 로컬 fallback |
| **자세 사용 설명서** (공통 4개 섹션) | **DB 우선** | `result_guide` (body_code NULL) | DB에 행 있으면 DB 사용, **없으면** `resultGuideContent.ts` 하드코딩 fallback |
| **자세 사용 설명서** (체형별 섹션) | **DB** | `result_guide` (body_code = FRRS 등) | 있으면 공통 뒤에 이어서 표시, 없으면 공통만 |
| **맞춤 가이드(다음 페이지)** – 공통 | **DB** | `result_guide` (body_code NULL) | `fetchResultGuideCommon()` |
| **맞춤 가이드(다음 페이지)** – 체형별 | **DB** | `body_code_next_page` | `fetchBodyCodeNextPage(bodyCode)` |
| **결과 0)~5) 아코디언** (알아보기, 한눈에보기, 이해/공감/주의/자가루틴) | **DB** | `body_code_result_sections` | **맞춤 가이드 → 다음 페이지** 이동 시 전용 화면에서 0)~5) 아코디언 표시. DB 있으면 DB, 없으면 폴백 |

**요약**

- **진단 결과**: 캐릭터·설명·운동·팁·용품·이미지 → **DB**(`body_code_content`, `app_images`). 생체%/4축/키워드 → **앱에서 계산**.
- **자세 사용 설명서**: **DB 우선** (`result_guide`). 공통은 DB 비어 있으면 `resultGuideContent.ts` fallback.
- **맞춤 가이드**: **전부 DB** (`result_guide` 공통 + `body_code_next_page` 체형별).
- **0)~5) 체형별 상세**: **맞춤 가이드** 화면에서 **다음 페이지**를 누르면 0)~5) 아코디언 전용 화면으로 이동하며, `body_code_result_sections`에서 조회 (DB 없으면 폴백).

---

## 2. PPT/스펙 대비 현황 (차이 정리)

### 2-1. doc/ver2 TODO (문항·축·결과 콘텐츠)

| 항목 | 스펙/문서 | 현재 | 일치 | 남은 작업 |
|------|-----------|------|------|-----------|
| 문항 엑셀 반영 | ver2 문항 엑셀 → questions 또는 시드 | ver2 문항은 `ver2Questions.ts` 등 코드 기준 사용 | △ | DB questions 반영 시 동기화 |
| 화면 스펙 (PPT) | MEBODY_ScreenSpec_Template | 레이아웃·텍스트는 비슷하게 구현, 일부 차이 | △ | PPT와 화면별로 1:1 점검 |
| 자세 사용 설명서 (공통) | 워드 → 결과/자세 설명 | 공통 4개 섹션, DB 또는 resultGuideContent fallback | ✅ | 워드 최종본 → DB 또는 코드 반영 |
| 결과 콘텐츠 16코드 | body_code_content ver2 스펙 | DB body_code_content 사용 중 | △ | ver2 캐릭터명·설명·운동 등으로 DB 갱신 |
| 축 아이콘 | doc/ver2/축 아이콘 | ResultScreen 등에서 axisIcons 경로 사용 | △ | ver2 아이콘 파일로 교체·경로 정리 |

### 2-2. Screen Spec 07 (결과·무료 제공 화면)

| 항목 | 스펙 (PPT/이미지) | 현재 구현 | 일치 | 남은 작업 |
|------|-------------------|-----------|------|-----------|
| 결과 1페이지 레이아웃 | 0)~3) 아코디언 + "다음 페이지 >" | **한 페이지 풀 스크롤** (생체 분석, 4축, 키워드, 이미지, 운동 등) | ❌ | 스펙 따르려면 결과를 0)~5) 아코디언 구조로 변경 검토 |
| 결과 하단 버튼 문구 | "다음 페이지 >" | **"프로그램 시작"** | ❌ | 문구만 "다음 페이지 >"로 변경 가능 |
| 0)~5) 체형별 아코디언 | 결과 또는 다음 카드에 0)~5) 제목·내용 | **맞춤 가이드 → 다음 페이지** 시 0)~5) 아코디언 전용 화면에서 표시 | ✅ | - |
| 자세 사용 설명서 | (스펙에선 결과 내 서브 섹션) | **별도 화면** + 아코디언 (공통 4섹션) | △ | 현재 구조 유지해도 됨 (다음 페이지부터 가이드) |
| 다음 페이지 플로우 | 4), 5) → "다음 페이지 >" → 3번째 블록 | ResultGuide → NextPage (맞춤 가이드) → 심화 플레이스홀더 | ✅ | - |
| "내 mebody 코드 더 알아보기" | 3번째 블록 녹색 CTA | NextPageScreen에 **있음** (심화로 이동) | ✅ | - |
| 프로그레스바·전체 16 이미지 | (위치 스펙에 따라 다름) | **다음 페이지**(자세 설명서·맞춤 가이드) 하단에 표시 | ✅ | - |

### 2-3. 구현된 것 vs 아직 안 된 것 (한눈에)

**구현된 것**

- 진단 결과: 생체 정보 분석, 4축 분석, 키워드, 전체 16 이미지, 운동·팁·용품, **DB** `body_code_content`·`app_images` 연동
- 자세 사용 설명서: 공통 아코디언, **DB** `result_guide` 우선 + 코드 fallback
- 맞춤 가이드: 공통 + 체형별, **DB** `result_guide` + `body_code_next_page`
- 다음 페이지 하단: 프로그레스바 + 전체 16 체형 이미지
- "내 mebody 코드 더 알아보기" → 심화(플레이스홀더) 이동
- 0)~5)용 DB 테이블·API·SQL 안내 (`body_code_result_sections`) + **맞춤 가이드에서 다음 페이지 클릭 시 0)~5) 아코디언 화면 표시**

**아직 스펙과 다른 것 / 더 해야 할 것**

- 결과 화면은 **풀 스크롤 유지** (0)~5)는 맞춤 가이드 → 다음 페이지에서 표시하므로 PPT 플로우와 유사하게 맞춤)
- 결과 하단 버튼 문구: "프로그램 시작" → **"다음 페이지 >"** 로 바꿀지 결정
- ver2 문항·캐릭터·설명 등 **DB 최종 반영** (엑셀·워드 기준)
- PPT(MEBODY_ScreenSpec)와 **화면별 1:1 비교** 후 차이만 수정

---

## 3. TODO 체크리스트 (우선순위)

### A. 가이드·자료 DB화 정리 (지금 궁금한 부분)

- [ ] **자세 사용 설명서 공통**: Supabase `result_guide` (body_code NULL)에 1건 넣었는지 확인. 없으면 `resultGuideContent.ts` fallback만 동작함.
- [ ] **맞춤 가이드 체형별**: `body_code_next_page`에 필요한 체형(FRRS 등) INSERT 했는지 확인.
- [ ] **(선택) 0)~5) 아코디언**: `body_code_result_sections`에 워드 내용 넣고, 화면에 0)~5) 아코디언을 다시 넣을지 결정.

### B. 스펙/PPT와 맞추기

- [ ] 결과 하단 버튼 문구: **"프로그램 시작" → "다음 페이지 >"** 로 변경할지 결정 후 반영.
- [ ] 결과 화면을 **0)~5) 아코디언** 구조로 바꿀지 결정. (할 경우 `body_code_result_sections` 사용)
- [ ] **MEBODY_ScreenSpec_Template** PPT와 랜딩·설문·결과·다음 페이지 비교 후 누락/차이 수정.

### C. Ver2 데이터 반영

- [ ] **body_code_content**: ver2 캐릭터명·설명·운동·팁·용품으로 16코드 갱신.
- [ ] **문항**: ver2 문항 엑셀 기준으로 DB 또는 시드 반영 (이미 코드로 쓰는 부분과 통일).
- [ ] **축 아이콘**: ver2 축 아이콘으로 교체 후 경로 정리.

### D. 검증

- [ ] Supabase 연결된 상태에서 **자세 사용 설명서** 열었을 때 DB 공통 4섹션이 나오는지 확인.
- [ ] **맞춤 가이드**에서 체형별 블록이 DB(`body_code_next_page`)에서 나오는지 확인.
- [ ] (0)~5) 아코디언 도입 시) `body_code_result_sections` INSERT 후 화면에 반영되는지 확인.

---

## 4. 참고 파일

| 목적 | 파일 |
|------|------|
| SQL 실행 (테이블·데이터) | `mebody/supabase/할일_및_실행할_SQL.md` |
| 스펙 07 상세 비교 | `mebody/supabase/스펙07_결과페이지_검증.md` |
| Ver2 전환 TODO (문항·축·결과) | `doc/ver2/TODO.md` |
| 공통 가이드 fallback 데이터 | `mebody/src/data/resultGuideContent.ts` |
| DB 조회 API | `mebody/src/api/content.ts`, `mebody/src/api/questionnaire.ts` |

이 문서를 기준으로 PPT/스펙 대비 **차이**와 **가이드·자료의 DB 연동 여부**를 점검하고, 위 TODO 순서대로 진행하면 됩니다.
