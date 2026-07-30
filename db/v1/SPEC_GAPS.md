# MEBODY V1 — 스펙 갭 / 제품 우선순위

엑셀 `MEBODY_V1_2차문항_최종_개발명세.xlsx` ⑯ QA·⑫·⑭ 대비 구현 상태.

## 완료

| 항목 | 상태 |
|---|---|
| 32문항 / 96 Mapping ↔ 앱 스냅샷 | `npm run verify:v1-excel` |
| 축 동점 앵커 (가산점 없음) | `bodyCodeCalculator` |
| 아이덴티티 정규화 max 11/7/14/9 | 동일 |
| 아이덴티티 동률 해소 (Primary ① → Primary 점수) | 동일 |
| 강화 규칙 → `scoringMeta.identity_boosts` (점수 미변경) | 동일 |
| 중단 문항 점수 제외 API | `calculateBodyCode(answers, undefined, { stoppedQuestionCodes })` |
| 축 완전동점 → `mixed` + `tie` + low_confidence (16코드는 fallback 문자 유지) | 동일 |

## 제품 합의 후 (UX/정책)

1. **검사 중단 UI** — 통증/어지럼 버튼 → `stoppedQuestionCodes` 전달. 계산 API는 준비됨, 문항 화면 플로우는 미연결.
2. **mixed 축 공식 출력** — 지금은 16코드 문자열에 fallback 문자 + `scoringMeta.axis_mixed`. 별도 “혼합형” 표시 문구/코드는 CEO·기획 합의 필요.
3. **강화 배지 카피** — `identity_boosts`를 결과 화면 문구에 노출할지 여부.
4. **결과 콘텐츠** — Body Code / 아이덴티티 설명 문장이 스펙 의미와 맞는지 편집 검수.

## 검증

```bash
# Excel ⑩/⑪ ↔ 앱 스냅샷 (openpyxl 필요)
python3 -m venv .venv && .venv/bin/pip install openpyxl
.venv/bin/python scripts/verify-v1-excel-spec.py

# + Supabase (optional)
VERIFY_DB=1 .venv/bin/python scripts/verify-v1-excel-spec.py
```
