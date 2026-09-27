# MEBODY 마이 바디 노트 — 설계

- 작성일: 2026-09-27 (KST)
- 상태: **설계만. 코드·마이그레이션 변경 없음.**
- 조사 범위: 앱 `mebody-jjh` · 서버 `mebody-server` · 운영 DB(읽기 전용)
- 선행 확인: 마이그레이션 070 적용 완료 · 071(동의 원장) 미적용

---

## 0. 결론부터

**만들 수 있다. 전문가 쪽은 거의 새로 만들 것이 없다.**

전문가 확장 Phase 1~5 에서 이미 만든 것이 그대로 쓰인다 — 관계·동의·권한 가드·콘솔 탭·미션 배정·
주의 목록. 바디 노트는 그 위에 **데이터 한 종류를 더하는 일**이다.

새로 필요한 것은 두 테이블과 화면 두 개다. 나머지는 복제다.

**가장 위험한 지점은 미션 피드백과의 경계다.** 둘 다 "오늘 몸이 어땠나" 를 묻는다.
경계를 흐리면 사용자는 같은 걸 두 번 적게 되고, 둘의 숫자가 어긋나기 시작한다.
그래서 이 문서는 **"미션을 했을 때"와 "미션과 무관한 하루"** 로 역할을 딱 나눈다.

---

## 1. 지금 그대로 쓸 수 있는 것

전수 조사해 파일·줄까지 확인한 것만 적는다.

### 1.1 권한 — 새로 설계할 것이 없다

전문가가 고객 데이터를 보는 통로가 이미 네 개 있고 **가드가 전부 같은 모양**이다.

| 함수 | 파일 | 역할 |
|---|---|---|
| `current_professional_id()` | `db/journey/052` | 호출자가 활성 전문가인가 |
| `get_client_response()` | `db/journey/053` | 체형 결과 |
| `get_client_journey_summary()` | `db/journey/056` | 수행 기록 |
| `assign_client_mission()` | `db/journey/059` | 미션 배정 |
| `get_client_attention_list()` | `db/journey/070` | 주의 목록 |

통과 조건이 다섯 군데 모두 같다.

1. `current_professional_id() IS NOT NULL` — 활성 전문가
2. `professional_clients.status = 'ACTIVE'`
3. `professional_clients.consented_at IS NOT NULL`

어긋나면 **오류가 아니라 빈 결과**다. 오류가 갈리면 관계 여부를 떠볼 수 있기 때문이다.

**바디 노트도 이 모양을 한 벌 더 뜬다.** 조건을 새로 쓰지 않는다.

### 1.2 서버 — 통로가 이미 있다

| 자산 | 파일 | 재사용 방식 |
|---|---|---|
| `UserScopedDb.as(authUserId, work)` | `common/security/UserScopedDb.java` | `request.jwt.claims` 를 한 연결에 세팅. `SECURITY DEFINER` 함수 호출 전제 |
| `requireProfessionalId(me)` | `professional/service/ProfessionalService.java` | 전문가 아니면 403 |
| `recordActivity(pro, client, event)` | 같은 파일 | 열람 기록. `professional_activity_log` |
| `/api/professional/**` 보안 | `SecurityConfig.java` | 별도 등록 없이 인증 필요. 역할은 서비스가 판정 |

### 1.3 전문가 콘솔 — 탭 추가 자리가 있다

`static/index.html` + `assets/web.js` 에 이미 「고객 관리」·「지표」 탭이 있고,
고객 상세를 여는 `openClient(clientUserId, name)` 가 있다. 그 안에 블록을 하나 더 넣는다.

- 결과 블록 · 수행 기록 블록 · **DRAFT(초안) 블록** · 배정 블록 · 주의 목록 블록이 이미 공존한다
- 「몸 기록」 블록은 여섯 번째다. 새 화면 구조가 필요하지 않다

### 1.4 앱 — 내 상태 화면과 시트 패턴

| 자산 | 파일 | 재사용 방식 |
|---|---|---|
| `StatusScreen` | `components/status/StatusScreen.tsx` | 카드를 하나 더 얹는다. 이미 적립금·챌린지·월 상한 카드가 쌓여 있다 |
| `MissionFeedbackSheet` | `components/journey/MissionFeedbackSheet.tsx` | **선택 UI 패턴을 그대로 쓴다** — `OptionGroup` 컴포넌트, 시트 레이아웃, 저장 중 상태, 오류 문구 |
| `useFlowHistory` | `utils/useFlowHistory.ts` | 뒤로가기. `FlowRoute` 에 값을 더하면 새로고침·하드웨어 백이 함께 복구된다 |
| `track()` | `lib/analytics.ts` | 이벤트. **동의 게이트가 방금(2026-09-27) 들어갔다** |

### 1.5 콘텐츠 라이브러리 — 처방을 새로 만들지 않는다

`assignableContents()`(`ProfessionalService.java:445`)가 `immediate_action_content` 23행을
`journey_content_tags` 의 축·방향 태그와 함께 돌려준다. 전문가가 권장 행동을 붙일 때
**이 목록 안에서만** 고른다. 새 동작을 만들 수 있게 하면 검증되지 않은 지시가 나간다.

---

## 2. 새로 필요한 것

| 항목 | 왜 필요한가 |
|---|---|
| `body_notes` 테이블 | 미션을 하지 않은 날에도 기록해야 한다. `journey_mission_feedback` 은 `user_mission_id` 가 NOT NULL 이라 미션 없는 날을 담을 수 없다 |
| `professional_body_note_guidance` 테이블 | 사용자 기록과 전문가 안내를 한 테이블에 섞으면 "전문가가 내 기록을 고쳤나" 를 구분할 수 없다 |
| 조회·쓰기 함수 5개 | 권한 판정을 DB 안에 한 벌만 둔다 |
| 앱 화면 2개 | 오늘 기록 작성 시트 · 마이 바디 노트 타임라인 |
| 콘솔 블록 1개 | 고객 상세의 「몸 기록」 |
| 앱 API 6개 · 서버 API 5개 | 아래 6장 |

### 2.1 미션 피드백과의 경계 — 가장 중요한 결정

**둘을 합치지 않는다. 그리고 서로를 대신하지 않는다.**

|  | 미션 피드백 | 바디 노트 |
|---|---|---|
| 언제 | 미션을 끝낸 직후 | 하루 중 아무 때, 하루 한 번 |
| 무엇을 | **그 동작**이 어땠나 | **오늘 하루**가 어땠나 |
| 묻는 것 | 가벼워졌다/비슷/불편 · 쉬웠다/적당/힘들었다 | 불편 부위 · 좌우 · 활동 · 상태 · 메모 |
| 쓰이는 곳 | 다음 미션 강도·시간 조정 (`selectDailyMissions`) | 초기에는 **아무것도 자동으로 바꾸지 않는다** |
| 테이블 | `journey_mission_feedback` | `body_notes` |

**초기 버전에서 바디 노트는 추천을 건드리지 않는다.** 이유는 두 가지다.

1. 표본이 없다. 무엇이 신호인지 모르는 상태에서 알고리즘을 바꾸면 사용자 경험이 나빠질 뿐
   원인을 알 수 없다.
2. 미션 피드백은 이미 112개 테스트로 고정된 규칙 엔진에 물려 있다. 여기에 검증되지 않은
   입력을 더하면 그 테스트가 무엇을 지키는지 흐려진다.

타임라인에서는 **둘을 같이 보여준다.** 같은 날짜에 미션 피드백과 바디 노트가 있으면
두 줄로 나란히 놓는다. 하나로 합치지 않는다 — 출처가 다르다는 것이 정보다.

---

## 3. 화면 흐름 전체

### 3.1 사용자

```
내 상태 (탭)
 └─ [오늘의 몸 기록] 카드
     ├─ 오늘 기록 없음 → "기록하기" → 작성 시트
     ├─ 오늘 기록 있음 → 요약 한 줄 + "수정"  → 작성 시트(기존 값 채움)
     └─ "전체 보기" → 마이 바디 노트
                        ├─ 오늘
                        ├─ 날짜별 타임라인 (7일 / 30일 필터)
                        │    ├─ [내 기록]     배지 — 수정 · 삭제
                        │    ├─ [전문가 안내] 배지 — 작성자 · 시각 · 읽음 표시
                        │    └─ [미션 피드백] 배지 — 읽기만 (journey_mission_feedback)
                        └─ 반복 경향 (기록 3건 이상일 때만)

홈 (탭)
 └─ 오늘 기록이 없을 때만 보조 CTA — "오늘 몸 상태를 기록해보세요 · 약 30초 / 나중에"
     · 진단·미션 카드 **아래**에 둔다. 핵심 흐름을 가리지 않는다
     · "나중에" 를 누르면 그 날은 다시 띄우지 않는다 (localStorage, 날짜 키)
```

### 3.2 전문가

```
콘솔 → 고객 관리 → [결과 보기]
 └─ 고객 상세
     ├─ 결과 (기존)
     ├─ 수행 기록 (기존)
     ├─ 계획 초안 (기존)
     ├─ 미션 배정 (기존)
     └─ 몸 기록 ← 새로 만드는 블록
          ├─ 요약: 7일 / 30일 — 기록 수 · 자주 나온 부위 · 자주 나온 활동 · 상태 분포
          ├─ 필터: 부위 · 좌우 · 활동
          ├─ 날짜별 기록 목록 (읽기만)
          └─ [안내 남기기]
               ├─ 유형: 일반 코멘트 / 다음 상담에서 확인 / 생활 행동 제안 / 기존 미션 연결
               ├─ 본문 최대 500자
               ├─ (선택) 승인 콘텐츠 연결 — assignableContents() 목록에서만
               └─ (선택) [미션으로 배정] → 기존 assignMission 으로 이동
```

---

## 4. DB 스키마

### 4.1 `body_notes` — 사용자 자기 기록

```sql
CREATE TABLE public.body_notes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- Asia/Seoul 기준의 "사용자 날짜". 서버 UTC 날짜를 쓰면 밤 9시 이후 기록이
  -- 다음 날로 넘어간다. 앱이 KST 날짜를 만들어 보내고 함수가 다시 검증한다.
  record_date      date NOT NULL,

  discomfort_parts text[] NOT NULL DEFAULT '{}',
  side             text,
  activity_tags    text[] NOT NULL DEFAULT '{}',
  condition        text NOT NULL,
  note             text,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- 하루 한 건. 같은 날 다시 저장하면 UPDATE 다(새 행이 아니다).
  CONSTRAINT body_notes_one_per_day UNIQUE (user_id, record_date),

  -- 허용값을 DB 가 지킨다. 화면만 믿으면 API 를 직접 부르는 쪽으로 다른 값이 들어온다.
  CONSTRAINT body_notes_side_check CHECK (
    side IS NULL OR side IN ('left','right','both','similar','unsure')),
  CONSTRAINT body_notes_condition_check CHECK (
    condition IN ('comfortable','usual','slightly_uncomfortable','very_uncomfortable')),
  CONSTRAINT body_notes_parts_check CHECK (
    discomfort_parts <@ ARRAY['none','neck','shoulder','back','waist','pelvis',
                              'knee','ankle','other']::text[]),
  CONSTRAINT body_notes_activity_check CHECK (
    activity_tags <@ ARRAY['sitting_long','standing_long','walking','exercise',
                           'driving','screen','rest','other']::text[]),
  CONSTRAINT body_notes_note_len CHECK (note IS NULL OR char_length(note) <= 300),
  -- 미래 날짜를 막는다. 앱 시계가 틀려도 내일 기록이 들어오면 안 된다.
  CONSTRAINT body_notes_not_future CHECK (
    record_date <= ((now() AT TIME ZONE 'Asia/Seoul')::date + 1))
);
```

**`'none'`(없음)과 다른 부위를 같이 고르는 것**은 CHECK 로 막지 않는다.
DB 제약으로 표현하면 복잡해지고, 실수로 둘을 고른 사용자를 오류로 막는 것은 과하다.
저장 함수에서 `'none'` 이 있으면 다른 값을 버린다.

**의료 표현을 쓰지 않는다.** 컬럼 이름이 `pain_score`·`symptom`·`diagnosis` 가 아니라
`discomfort_parts`·`condition` 이다. 값도 `severe`·`acute` 가 아니라
`slightly_uncomfortable`·`very_uncomfortable` 이다.

### 4.2 `professional_body_note_guidance` — 전문가 안내

```sql
CREATE TABLE public.professional_body_note_guidance (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id     uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  professional_id    uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,

  -- 특정 기록에 달린 코멘트면 그 기록. 기간 전체에 대한 안내면 NULL.
  -- 기록이 지워지면 안내는 남지만 어디에 달렸는지는 잃는다 — 본문은 살린다.
  body_note_id       uuid REFERENCES public.body_notes(id) ON DELETE SET NULL,

  guidance_type      text NOT NULL,
  message            text NOT NULL,

  -- 권장 행동은 승인 콘텐츠에서만 고른다. 자유 입력이 아니다.
  linked_content_key text REFERENCES public.immediate_action_content(content_key),
  linked_mission_id  uuid REFERENCES public.user_missions(id) ON DELETE SET NULL,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  -- 철회는 줄을 지우지 않고 시각을 찍는다. 사용자가 이미 읽었을 수 있다.
  withdrawn_at       timestamptz,

  -- 사용자가 읽었는지. 앱 내부 배지에 쓴다.
  read_at            timestamptz,

  CONSTRAINT pbng_type_check CHECK (guidance_type IN (
    'comment', 'check_next_session', 'lifestyle_suggestion', 'linked_mission')),
  CONSTRAINT pbng_message_len CHECK (char_length(message) BETWEEN 1 AND 500)
);
```

### 4.3 권한 — Supabase 기본값을 걷어낸다

이 프로젝트에서 반복해서 물린 함정이므로 두 테이블 모두 같이 처리한다.

```sql
-- Supabase 는 public 스키마의 새 테이블에 GRANT ALL 을 주고 거기에 TRUNCATE 가 들어 있다.
-- **TRUNCATE 는 RLS 를 우회한다.** 041·048·052·054·056·071 과 같은 이유로 먼저 걷어낸다.
REVOKE ALL ON public.body_notes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.professional_body_note_guidance FROM PUBLIC, anon, authenticated;

-- 사용자 기록은 본인이 직접 다룬다(RLS 로 제한).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_notes TO authenticated;
-- 전문가 안내는 읽기만. 쓰기는 서버가 함수로 한다.
GRANT SELECT ON public.professional_body_note_guidance TO authenticated;
```

`CREATE FUNCTION` 은 EXECUTE 를 PUBLIC 에 준다. Supabase 기본 권한은 `anon` 에게도
따로 준다. **둘 다 회수해야 한다** — 한쪽만 하면 `anon` 이 남는다.

---

## 5. RLS · 서버 권한 설계

### 5.1 사용자 — RLS 로 처리한다

```sql
ALTER TABLE public.body_notes ENABLE ROW LEVEL SECURITY;

-- 본인 기록만. 네 정책을 따로 쓴다 — FOR ALL 로 묶으면 INSERT 의 WITH CHECK 를 빼먹기 쉽다.
CREATE POLICY body_notes_select ON public.body_notes FOR SELECT TO authenticated
  USING (user_id = public.current_profile_id());
CREATE POLICY body_notes_insert ON public.body_notes FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY body_notes_update ON public.body_notes FOR UPDATE TO authenticated
  USING (user_id = public.current_profile_id())
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY body_notes_delete ON public.body_notes FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id());
```

`current_profile_id()` 는 `auth.uid()` → `user_profiles.id` 를 돌려주는 헬퍼다.
지금 각 정책이 이 서브쿼리를 직접 쓰고 있어 같은 문장이 여러 벌 있다.
**이 작업에서 헬퍼로 뽑는다** — 조건이 여러 곳에 흩어져 있으면 한 곳만 고치는 사고가 난다.

전문가 안내를 사용자가 읽는 것도 RLS 로 한다.

```sql
CREATE POLICY pbng_read_own ON public.professional_body_note_guidance
  FOR SELECT TO authenticated
  USING (client_user_id = public.current_profile_id() AND withdrawn_at IS NULL);
```

**왜 서버 API 가 아니라 RLS 인가.** 사용자가 자기 데이터를 읽는 일이고, 조건이
`client_user_id = 나` 한 줄이다. 서버를 거치면 `VITE_API_BASE_URL` 이 틀리면 화면이 비고
(2026-09-22 감사 P0-1 이 정확히 그 사고였다), 오프라인 캐시도 못 쓴다.
**전문가가 남의 데이터를 읽는 것만 서버·DEFINER 함수로 한다** — 거기가 위험한 쪽이다.

### 5.2 전문가 — SECURITY DEFINER 함수로만

전문가에게 `body_notes` 테이블 SELECT 를 **주지 않는다.** RLS 정책을 넓히는 대신
053·056·059·070 과 같은 모양의 함수를 만든다.

```sql
-- 전문가가 고객 기록을 읽는다. 가드는 070 과 똑같다.
CREATE FUNCTION public.get_client_body_notes(p_client_user_id uuid, p_days int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_pro uuid := public.current_professional_id();
BEGIN
  IF v_pro IS NULL OR p_client_user_id IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.professional_clients pc
     WHERE pc.professional_id = v_pro
       AND pc.client_user_id  = p_client_user_id
       AND pc.status          = 'ACTIVE'
       AND pc.consented_at   IS NOT NULL
  ) THEN RETURN NULL; END IF;   -- 오류가 아니라 빈 결과
  ...
END; $$;
```

같은 가드로 넷을 더 만든다.

| 함수 | 역할 | 반환 |
|---|---|---|
| `get_client_body_notes(uuid, int)` | 기간 내 기록 목록 | jsonb |
| `get_client_body_note_summary(uuid, int)` | 빈도 요약 | jsonb |
| `create_body_note_guidance(uuid, uuid, text, text, text, uuid)` | 안내 작성 | uuid |
| `update_body_note_guidance(uuid, text)` | 본문 수정 | boolean |
| `withdraw_body_note_guidance(uuid)` | 철회(시각 찍기) | boolean |

**전문가는 사용자 기록을 고칠 수 없다.** 읽기 함수만 주고, `body_notes` 에 대한
UPDATE·DELETE 함수를 만들지 않는다. 만들지 않으면 경로가 없다.

**철회 직후 차단.** 함수가 매 호출마다 관계를 다시 본다. 캐시하지 않는다.
`consented_at` 이 사라지거나 `status` 가 `REVOKED` 가 되면 그 다음 호출부터 NULL 이다.

**안내 작성도 같은 가드를 통과해야 한다.** 관계가 끊긴 뒤에는 쓰지도 못한다.
자기가 쓴 안내만 고치고 철회할 수 있다(`professional_id = current_professional_id()`).

### 5.3 무엇을 반환하지 않는가

053·056·070 과 같은 원칙이다. 전문가에게 필요한 건 기록이지 신상이 아니다.

- 이메일 · 전화번호 · 32문항 답변 원문 · `auth_user_id` 를 반환하지 않는다
- `client_user_id` 는 반환한다 — 고객 목록(`listClients`)이 이미 주고 있는 값이다

---

## 6. API 명세

### 6.1 앱 (Supabase 직접 · RLS)

`src/api/bodyNote.ts` 를 새로 만든다.

| 함수 | 동작 |
|---|---|
| `fetchTodayBodyNote()` | KST 오늘 날짜의 기록 1건 또는 null |
| `fetchBodyNotes(fromDate, toDate)` | 기간 내 기록. 날짜 내림차순 |
| `saveBodyNote(input)` | `upsert` on `(user_id, record_date)`. 같은 날 재저장은 UPDATE |
| `deleteBodyNote(id)` | 본인 기록만 (RLS) |
| `fetchMyGuidance(fromDate, toDate)` | 나에게 온 전문가 안내. 철회된 것은 제외 |
| `markGuidanceRead(id)` | `read_at` 을 찍는다 |

`markGuidanceRead` 만 예외적으로 사용자가 전문가 테이블을 UPDATE 해야 한다.
**컬럼 하나만 열 수 없으므로** `SECURITY DEFINER` 함수 `mark_guidance_read(uuid)` 로 한다
(자기에게 온 안내의 `read_at` 만 찍는다).

`upsert` 를 쓰는 이유: 조회 후 INSERT/UPDATE 를 나누면 그 사이에 같은 날 기록이
생겨 UNIQUE 위반이 난다. 반복 클릭에서 실제로 일어난다.

### 6.2 전문가 (서버)

| 메서드 · 경로 | DB 함수 | 활동 기록 |
|---|---|---|
| `GET /api/professional/clients/{id}/body-notes?days=7` | `get_client_body_notes` | `body_notes_viewed` |
| `GET /api/professional/clients/{id}/body-notes/summary?days=30` | `get_client_body_note_summary` | — |
| `POST /api/professional/clients/{id}/body-note-guidance` | `create_body_note_guidance` | `guidance_created` |
| `PATCH /api/professional/body-note-guidance/{guidanceId}` | `update_body_note_guidance` | — |
| `DELETE /api/professional/body-note-guidance/{guidanceId}` | `withdraw_body_note_guidance` | — |

`professional_activity_log.event` CHECK 에 `body_notes_viewed` · `guidance_created` 를 더한다
(068·070 이 같은 방식으로 넓혔다).

**DELETE 는 실제로 지우지 않는다.** `withdrawn_at` 을 찍는다.
사용자가 이미 읽었을 수 있고, "전문가가 무슨 말을 했었나" 를 지울 권한은 전문가에게 없다.

---

## 7. 화면별 구성

### 7.1 오늘 기록 작성 시트

`MissionFeedbackSheet` 의 `OptionGroup` 을 그대로 쓴다. 5개 묶음.

| # | 질문 | 형태 | 값 |
|---|---|---|---|
| 1 | 오늘 불편했던 부위 | 복수 선택 | none·neck·shoulder·back·waist·pelvis·knee·ankle·other |
| 2 | 더 편하거나 불편했던 쪽 | 단일 | left·right·both·similar·unsure |
| 3 | 오늘 많이 했던 행동 | 복수 선택 | sitting_long·standing_long·walking·exercise·driving·screen·rest·other |
| 4 | 몸 상태 | 단일 · 필수 | comfortable·usual·slightly_uncomfortable·very_uncomfortable |
| 5 | 짧은 메모 | 선택 · 300자 · 글자 수 표시 | 자유 |

필수는 **4번 하나뿐**이다. 나머지를 다 필수로 하면 30초에 못 끝낸다.

**안전 안내.** `very_uncomfortable` 을 골랐거나 메모에 저림·어지럼·마비 관련 표현이 있으면
저장 후 안내를 띄운다.

> 불편이 심하거나 저림·어지럼이 있으면 이 기록보다 전문가 확인이 먼저입니다.
> MEBODY 는 의료 진단을 하지 않습니다.

**저장을 막지 않는다.** 막으면 사용자가 상태를 낮춰 적는다. 기록은 받고 안내를 띄운다.

### 7.2 마이 바디 노트 타임라인

- 필터: 최근 7일 / 30일
- 한 날짜 안에 세 종류가 섞인다 — 배지로 구분한다

| 배지 | 출처 | 가능한 동작 |
|---|---|---|
| `내 기록` | `body_notes` | 수정 · 삭제 |
| `전문가 안내` | `professional_body_note_guidance` | 읽음 표시. 수정·삭제 불가 |
| `미션 피드백` | `journey_mission_feedback` | 읽기만 |

상태: 로딩 · 빈 상태 · 저장 실패 + 재시도 · 오프라인.

전문가 안내에는 **작성 전문가 이름과 작성 시각**을 반드시 표시한다.
누가 언제 한 말인지 모르면 사용자가 자기 기록과 구분할 수 없다.

### 7.3 반복 경향 — 기록 3건 이상일 때만

2건으로 "경향" 을 말하면 우연을 패턴으로 제시하는 것이다.

허용 문구 — 관찰만 말한다.

- 최근 7일 중 오른쪽 어깨 불편을 4회 기록했어요.
- 오래 앉은 날에 목·어깨 불편 기록이 자주 남았어요.
- 이번 주에는 지난주보다 '조금 불편했다' 기록이 줄었어요.
- 사용자가 남긴 기록에서 함께 나타난 경향입니다. 이 기록만으로 원인을 판단할 수 없습니다.

금지 문구 — 인과·진단·치료.

- ~~오래 앉아서 목 통증이 발생했습니다.~~ (인과)
- ~~골반이 틀어졌습니다.~~ (진단)
- ~~치료가 필요합니다.~~ (치료)
- ~~이 운동으로 증상이 호전됐습니다.~~ (효과 주장)

**검증 스위트로 막는다.** `verify:body-note-copy` 가 화면 문구에서 금지 표현을 찾는다.
`verify:reward-copy` 가 적립 금액을 같은 방식으로 막고 있어 패턴이 이미 있다.

---

## 8. 뒤로가기 · 오류 · 오프라인

### 8.1 뒤로가기

`FlowRoute` 에 값을 더한다. 새 `Screen` 을 추가하지 않는다 —
바디 노트는 「내 상태」 탭 안의 상태이고, 탭은 이미 `FlowTab` 에 있다.

```ts
export interface FlowRoute {
  // ...기존
  /** 마이 바디 노트가 열려 있는지. 'today' 는 작성 시트까지 열린 상태. */
  bodyNote?: 'list' | 'today';
  /** 타임라인에서 고른 날짜(YYYY-MM-DD). 뒤로 돌아왔을 때 같은 날로 복귀한다. */
  bodyNoteDate?: string;
}
```

| 상황 | 기대 동작 |
|---|---|
| 작성 시트에서 뒤로 | **시트만 닫는다.** 탭을 벗어나지 않는다 |
| 저장 안 된 입력이 있는 상태에서 뒤로 | 초안을 localStorage 에 남기고 닫는다. 다시 열면 채워져 있다 |
| 타임라인에서 뒤로 | 내 상태 카드로 복귀. **스크롤 위치와 고른 날짜를 유지** |
| 저장 성공 후 | 시트를 닫고 같은 스크롤 위치로. 화면을 위로 튀게 하지 않는다 |
| Android 하드웨어 백 | 위와 같다. `useFlowHistory` 가 `popstate` 로 같이 처리한다 |
| 전문가 안내 상세에서 뒤로 | 같은 고객의 몸 기록 블록으로 복귀 |

### 8.2 중복 생성 방지 — 세 겹

1. **DB**: `UNIQUE (user_id, record_date)`
2. **쿼리**: `upsert` — 조회 후 분기하지 않는다
3. **화면**: 저장 중 버튼 비활성화 (`isSaving`, `MissionFeedbackSheet` 와 같은 패턴)

전문가 안내도 같다. 「안내 남기기」 를 두 번 누르면 두 줄이 생긴다 —
`create_body_note_guidance` 가 **같은 전문가·같은 고객·같은 본문이 5초 안에 오면
앞의 id 를 돌려준다** (071 `record_consent()` 가 1초 창으로 같은 것을 한다).

### 8.3 초안 저장

```
키:  mebody:bodyNote.draft.v1.<YYYY-MM-DD>
값:  { discomfortParts, side, activityTags, condition, note, savedAt }
```

- 시트를 닫을 때마다 쓴다. 저장이 성공하면 지운다
- 날짜가 바뀌면 옛 키는 버린다 (열 때 오늘 것만 읽는다)
- **`localStorage` 는 사생활 모드·저장 차단에서 던진다.** 모든 읽기·쓰기를
  `try/catch` 로 감싸고, 없어도 화면이 정상 동작해야 한다

### 8.4 오프라인

- 읽기: 마지막으로 받은 목록을 화면에 유지하고 "연결이 끊겨 최신이 아닐 수 있어요" 를 띄운다
- 쓰기: **자동 재시도하지 않는다.** 초안을 남기고 "저장하지 못했어요 · 다시 시도" 를 띄운다
  자동 재전송은 사용자가 지운 줄 아는 기록을 나중에 되살릴 수 있다
- `sw.js` 는 지금 캐시를 전부 지우고 자신을 해제한다(2026-09-22 감사 P2-2).
  **바디 노트는 서비스 워커 캐시에 의존하지 않는다.** 오프라인 지원을 약속하지 않는다

---

## 9. 의료 표현 제한

**MEBODY 는 의료기기가 아니다.** 전문가 확장 Phase 1~5 에서 지킨 선을 그대로 지킨다.

| 쓰지 않는다 | 대신 쓴다 |
|---|---|
| 질환 · 진단 · 병명 | 사용자가 기록한 불편 경향 |
| 치료 · 처방 | 권장 행동 · 전문가 안내 |
| 통증 점수 · 통증 등급 | 몸 상태 (편안했다 ~ 많이 불편했다) |
| 증상 · 호전 · 악화 | 기록 · 늘었다 · 줄었다 |
| 원인은 ~ 입니다 | 함께 나타난 경향입니다 |

- **통증 점수(NRS·VAS)를 입력하게 하지 않는다.** 숫자로 받으면 의료 기록처럼 보인다
- 질환명을 입력할 자리를 만들지 않는다. 메모는 자유 입력이지만 자리 이름이 '짧은 메모' 다
- 전문가 안내 유형에 '진단'·'처방' 이 없다.
  `comment` · `check_next_session` · `lifestyle_suggestion` · `linked_mission` 네 가지다
- 권장 행동은 승인 콘텐츠 23개 안에서만 고른다. 자유 입력 운동 지시가 없다
- 안전 신호(심한 불편·저림·어지럼)에는 **전문가·의료기관 확인을 먼저** 안내한다

컬럼 이름·CHECK 값도 이 원칙을 따른다(4.1 참고). 나중에 화면 문구만 고치면
DB 에 `pain_score` 가 남아 감사에서 다시 걸린다.

---

## 10. Analytics · 개인정보

### 10.1 보낼 이벤트

`AnalyticsEvent` 유니온에 더한다.

```
body_note_prompt_viewed · body_note_started · body_note_saved
body_note_edited · body_note_deleted · body_note_history_viewed
professional_body_notes_viewed · professional_guidance_created · professional_guidance_viewed
```

### 10.2 보낼 속성

| 허용 | 예 |
|---|---|
| 진입 위치 | `entry: 'home' \| 'status' \| 'history'` |
| 선택 항목 개수 | `parts_count: 2`, `activities_count: 3` |
| 메모를 썼는지 (내용 아님) | `has_note: true` |
| 저장 성공 여부 | `saved: true` |
| 전문가 안내 유형 | `guidance_type: 'comment'` |
| 날짜 범위 | `range_days: 7` |

### 10.3 절대 보내지 않는 것

- 메모 원문
- **불편 부위 원문** (`parts_count` 는 되지만 `parts: ['neck']` 은 안 된다)
- **좌우 정보** (`side`)
- 사용자 ID · 이메일 · 전화번호
- 전문가가 작성한 안내 원문
- 날짜 그 자체 (`range_days` 만)

부위와 좌우를 제외하는 이유: 둘이 합쳐지면 "이 사람은 오른쪽 어깨가 불편하다" 가 되고
이것은 건강 관련 정보다. **개수만으로도 참여율은 측정된다.**

### 10.4 지금 들어간 동의 게이트와의 관계

2026-09-27 에 `track()` 에 동의 게이트가 들어갔다(`lib/analytics.ts`).
동의 전에는 `session_id` 와 `body_code` 를 보내지 않는다.

**바디 노트 이벤트도 같은 규칙을 그대로 받는다.** 새로 할 일이 없다.
다만 `CONSENT_ONLY_PROPS` 에 무엇을 더할지 판단해야 한다 — 위 10.3 을 지키면
바디 노트 속성에는 건강 관련 값이 아예 없으므로 **더할 것이 없다.**

### 10.5 서버 로그

- 메모 원문 · 안내 본문 · 부위 · 좌우를 로그에 남기지 않는다
- 예외 메시지에 SQL 파라미터가 섞이지 않게 한다.
  `ProfessionalService` 의 기존 `System.err.println` 패턴은 메시지만 찍고 값을 찍지 않는다
- 서비스 롤 키는 앱에 노출하지 않는다 (지금도 `VITE_` 접두 검사가 `env:check` 에 있다)

### 10.6 개인정보처리방침 반영

새 항목을 더해야 한다. **지금 문서에 플레이스홀더 4곳이 남아 있어
(2026-09-22 감사 P0-2) 그것과 함께 한 번에 고치는 편이 낫다.**

| 항목 | 내용 |
|---|---|
| 수집 항목 | 사용자가 직접 입력한 불편 부위·좌우·활동·몸 상태·메모 |
| 수집 목적 | 기록 제공, 반복 경향 안내, 동의한 전문가와의 상담 |
| 보유 기간 | 회원 탈퇴 시 삭제. 전문가 안내는 작성 사실만 남기고 주체 정보 삭제 |
| 제3자 제공 | **없음.** 전문가는 제3자가 아니라 사용자가 지정해 동의한 열람자다 |
| 열람 조건 | 관계 ACTIVE + 동의 유지. 철회 즉시 차단 |

---

## 11. 테스트 계획

### 11.1 DB · RLS — `verify:body-note` (BEGIN/ROLLBACK)

| 검사 | 기대 |
|---|---|
| 다른 회원 기록 조회 | 0행 |
| `anon` 접근 | 0행 · 권한 없음 |
| 활성 + 동의한 전문가 조회 | 보인다 |
| 초대 대기(`INVITED`) 전문가 | NULL |
| 동의 전(`consented_at IS NULL`) | NULL |
| 해지 후(`REVOKED`) | NULL |
| 다른 전문가의 고객 | NULL |
| 전문가가 사용자 기록 UPDATE | **경로가 없다** (함수 미존재 확인) |
| 같은 날짜 두 번 INSERT | UNIQUE 위반 |
| 300자 초과 메모 | CHECK 위반 |
| 허용되지 않은 부위·상태 값 | CHECK 위반 |
| 미래 날짜 | CHECK 위반 |
| 회원 탈퇴 | 기록 삭제(CASCADE) |
| 회원 탈퇴 | 전문가 안내는 본문 유지 · 주체 NULL |
| 철회된 안내 | 사용자에게 0행 |
| `anon` 의 함수 EXECUTE | 없음 |
| `authenticated` 의 함수 EXECUTE | 없음(전문가 함수) |
| 테이블 TRUNCATE 권한 | 없음 |

### 11.2 앱 — `verify:body-note-app`

작성 · 수정 · 삭제 · 같은 날 재저장 · 빈 기록 · 300자 경계 ·
네트워크 실패와 재시도 · 로딩 중 반복 클릭 · 브라우저 백 · 초안 복구 ·
저장 후 스크롤·날짜 유지 · 안내 배지와 읽음 · 접근성 이름 · 44px 터치 영역.

### 11.3 전문가 콘솔 — `verify:body-note-api`

`verify:professional-api`(70개) 와 같은 방식으로 **HTTP 로** 확인한다.

고객 기록 조회 · 날짜·부위 필터 · 안내 작성·수정·철회 ·
다른 전문가 데이터 차단(404) · 동의 철회 직후 차단 · 기존 미션 연결 ·
반복 클릭 중복 방지 · 원문이 응답과 로그에 남지 않는지.

### 11.4 문구 — `verify:body-note-copy`

9장의 금지 표현이 앱·콘솔 화면 문구에 있으면 실패.
`verify:reward-copy` 와 같은 방식(정적 파일 검사).

### 11.5 회귀

**기존 스위트 전체를 매번 돌린다.** 현재 37개다.
이 프로젝트에서 정리 작업이 세 가지를 조용히 깼던 전례가 있다(061·062 → 064·065·067).
새 기능이라 무관해 보여도 `verify:migrations` · `verify:account-deletion` ·
`verify:professional-api` 는 반드시 확인한다 — 탈퇴 경로와 전문가 권한을 건드리기 때문이다.

---

## 12. 단계별 구현 순서

### Phase 0 — 설계 · 보안 (이 문서)

- [x] 기존 구현·현재 DB 확인
- [x] 스키마 · RLS · 함수 · API 권한 설계
- [x] 화면 이동 구조
- [ ] **개인정보처리방침 반영** — 감사 P0-2 플레이스홀더와 함께 (사장님 정보 필요)
- [ ] 미확정 결정 5건 (14장)

### Phase 1 — 사용자 MVP

1. `072_body_notes.sql` — 테이블 · RLS · `current_profile_id()` 헬퍼
2. `src/api/bodyNote.ts`
3. 작성 시트 (`components/status/BodyNoteSheet.tsx`)
4. 내 상태 카드 (`StatusScreen` 수정)
5. 타임라인 (`components/status/BodyNoteHistory.tsx`)
6. 뒤로가기 · 초안 · 오류 · 오프라인
7. Analytics 이벤트 6개
8. `verify:body-note` · `verify:body-note-app` · `verify:body-note-copy`

**Phase 1 만으로 출시 가능해야 한다.** 전문가 기능 없이도 사용자에게 가치가 있는지
먼저 본다. 작성률이 낮으면 전문가 기능을 만들 이유가 없다.

### Phase 2 — 전문가 기능

1. `073_body_note_guidance.sql` — 테이블 · 함수 5개 · 활동 로그 event 확장
2. `ProfessionalService` 메서드 5개 · 컨트롤러 5개
3. 콘솔 「몸 기록」 블록
4. 앱의 전문가 안내 표시 · 읽음 배지
5. `verify:body-note-api`

### Phase 3 — 기록 요약

1. 7일·30일 빈도 요약 함수
2. 반복 경향 문구 (3건 이상)
3. 내 상태 리포트 연결
4. **주의 목록(070)에 신호 추가** — `body_note_concern`
   (최근 7일 '많이 불편했다' 반복). `attention_thresholds()` 에 기준값을 더한다

### Phase 4 — 데이터 검증 후 개인화

표본이 쌓인 뒤에만. 실험으로 하고 기본값을 바꾸지 않는다.

- 기록 기반 재측정 제안
- 반복 불편 부위에 맞춘 미션 조정
- 반복적으로 불편한 동작 제외
- 알림 실험

---

## 13. 예상 수정 파일

### 새로 만드는 파일

| 파일 | 내용 |
|---|---|
| `db/journey/072_body_notes.sql` | 테이블 · RLS · `current_profile_id()` |
| `db/journey/073_body_note_guidance.sql` | 전문가 안내 테이블 · 함수 5개 |
| `src/api/bodyNote.ts` | 앱 API 6개 |
| `src/components/status/BodyNoteSheet.tsx` | 작성 시트 |
| `src/components/status/BodyNoteHistory.tsx` | 타임라인 |
| `src/components/status/BodyNoteCard.tsx` | 내 상태 카드 |
| `src/data/bodyNoteOptions.ts` | 선택지 · 라벨 (DB CHECK 와 같은 값) |
| `scripts/verify-body-note.mjs` | DB·RLS |
| `scripts/verify-body-note-api.mjs` | 전문가 HTTP |
| `scripts/verify-body-note-app.mjs` | 앱 동작 |
| `scripts/verify-body-note-copy.mjs` | 금지 표현 |
| `mebody-server/.../bodynote/**` | DTO · 서비스 · 컨트롤러 |

### 고치는 파일

| 파일 | 무엇을 |
|---|---|
| `src/components/status/StatusScreen.tsx` | 카드 추가 |
| `src/components/home/HomeScreen.tsx` | 보조 CTA (오늘 기록 없을 때만) |
| `src/lib/flowNavigation.ts` | `FlowRoute` 에 `bodyNote` · `bodyNoteDate` |
| `src/App.tsx` | 라우트 복구 |
| `src/lib/analytics.ts` | 이벤트 9개 · props 키 |
| `mebody-server/.../ProfessionalService.java` | 메서드 5개 |
| `mebody-server/.../ProfessionalController.java` | 경로 5개 |
| `static/index.html` · `static/assets/web.js` | 「몸 기록」 블록 |
| `public/privacy.html` · `static/privacy.html` | 수집 항목 추가 |
| `scripts/verify-migrations.mjs` | 072 · 073 등록 |
| `package.json` | 스위트 4개 등록 |
| `docs/MEBODY_PROFESSIONAL_ROADMAP.md` | 바디 노트 연결 기록 |

---

## 14. 미확정 결정사항

**사장님 판단이 필요한 것들이다.** 제가 정하면 되돌리기 비싼 것만 골랐다.

### 14.1 하루 한 건이 맞나

지금 설계는 `UNIQUE (user_id, record_date)` 다. 아침에 멀쩡했다가 저녁에 아팠으면
덮어써야 한다. 하루 여러 건을 허용하면 "오늘의 기록" 이 무엇인지 모호해지고
타임라인이 길어진다.

**권장**: 하루 한 건으로 시작. 수정으로 충분한지 먼저 본다.

### 14.2 전문가에게 메모 원문을 보여줄 것인가

지금 설계는 보여준다. 전문가가 상담하려면 필요하다.
다만 사용자는 "이 메모가 트레이너에게 보인다" 를 작성 시점에 알아야 한다.

**권장**: 보여주되 **작성 시트에 명시한다** — "연결된 전문가가 볼 수 있어요".
이걸 안 적으면 나중에 분쟁이 된다.

### 14.3 기록 보유 기간

지금 설계는 탈퇴 시 삭제, 그 외 무제한이다. `analytics_events` 는 180일,
`professional_activity_log` 는 180일로 정리한다. 바디 노트는 사용자 자산이라
자동 삭제가 오히려 손해일 수 있다.

**권장**: 무제한 유지. 대신 사용자가 직접 삭제할 수 있게 한다(설계에 있음).

### 14.4 전문가 안내 알림

첫 버전은 앱 내부 배지만이다(요청대로). Push·SMS·이메일은 별도 동의와 발송 인프라가
필요하다. 지금 Supabase 기본 SMTP 는 전송 한도 때문에 실사용이 안 된다.

**권장**: 배지만. 커스텀 SMTP 가 붙은 뒤에 다시 본다.

### 14.5 Phase 1 만으로 출시할 것인가

바디 노트는 전문가 기능 없이도 쓸모가 있다. 작성률이 낮으면 전문가 기능은 만들 이유가 없다.

**권장**: Phase 1 을 먼저 내보고 15장의 기준으로 판단한다.

---

## 15. 출시 판정 기준

### 15.1 Phase 1 (사용자) — 기능 게이트

전부 통과해야 내보낸다.

- [ ] `verify:body-note` 전항 통과 (11.1)
- [ ] `verify:body-note-app` 전항 통과
- [ ] `verify:body-note-copy` — 금지 표현 0건
- [ ] **기존 37개 스위트 회귀 통과** — 특히 `verify:account-deletion`
- [ ] 개인정보처리방침에 수집 항목 반영 (플레이스홀더도 함께 해결)
- [ ] 300자 · 미래 날짜 · 같은 날 재저장 · 반복 클릭 실측
- [ ] 저장 실패 후 초안 복구 실측
- [ ] Android 하드웨어 백 실측 (APK 가 나온 뒤)

### 15.2 Phase 2 (전문가) — 보안 게이트

- [ ] 동의 철회 직후 조회·작성 모두 차단 실측
- [ ] 다른 전문가의 고객 접근 시 404 (존재 여부를 흘리지 않는다)
- [ ] 전문가가 사용자 기록을 고칠 경로가 없음을 확인
- [ ] 메모 원문이 Analytics·서버 로그에 없음을 확인
- [ ] 안내 반복 클릭으로 중복 생성되지 않음

### 15.3 성공 지표 — 만들 가치가 있었나

| 지표 | 무엇을 보는가 |
|---|---|
| 신규 사용자의 첫 7일 내 작성률 | 진입이 되는가 |
| 첫 기록 사용자 중 7일 내 3회 이상 비율 | **습관이 되는가** (가장 중요) |
| 전문가 연결 고객 중 전문가 기록 조회율 | 전문가가 실제로 보는가 |
| 조회한 고객 중 안내 작성률 | 보고 나서 행동하는가 |
| 안내의 사용자 확인율 | 안내가 닿는가 |
| 바디 노트 사용자와 미사용자의 D7·D14 유지율 차 | **제품에 도움이 되는가** |

### 15.4 실패 조건 — 접어야 하는 신호

- 첫 기록을 남긴 사용자 중 7일 내 3회 이상이 **20% 미만** → 작성 부담이 너무 크다.
  질문을 줄이거나 접는다
- 전문가가 몸 기록 블록을 여는 비율이 **주의 목록보다 낮으면** → 전문가에게 필요한 정보가
  아니다. Phase 2 를 접고 Phase 3(요약)만 남긴다
- D7 유지율 차이가 **통계적으로 유의하지 않으면** → Phase 4 개인화로 가지 않는다

---

## 부록 A — 이 문서가 기준으로 삼은 실제 상태

읽기 전용으로 확인한 값이다.

| 항목 | 값 |
|---|---|
| 적용된 마이그레이션 | `journey/070` 까지 (미적용 0 · 잔재 0) |
| 미적용 파일 | `071_consent_ledger.sql` (동의 원장) |
| 검증 스위트 | 37개 — 통과 33 · 실패 0 · 건너뜀 3 (2026-09-27) |
| `immediate_action_content` | 23행 |
| `journey_content_tags` | 23행 |
| 활성 문항 | 32개 (그중 실제 수행 필요 9개) |
| `journey_mission_feedback.difficulty` | GOOD · HARD · EASY |
| `user_missions.status` | scheduled · started · completed · skipped |
| 전문가 관계 상태 | INVITED · ACTIVE · REVOKED |
| `professional_activity_log.event` | client_opened · activity_viewed · assignment_created · assignment_cancelled · invite_sent · attention_viewed |

부록의 값은 조사 시점 것이다. 구현 전에 `npm run verify:migrations` 로 다시 확인한다.
