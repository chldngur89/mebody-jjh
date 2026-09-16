/**
 * body_code_content.starter_focus / progression_focus 의 키 → 사용자 문구
 *
 * DB 에는 `foot_support` 같은 내부 키가 들어 있는데, 홈의 "지금 바로 할 수 있는 것"
 * 자리에 그 키가 **그대로 노출되고 있었습니다**. 일반 사용자가 읽을 수 없는 말입니다.
 *
 * 문구는 "지금 바로 할 수 있는 것" 아래에 들어가므로 전부 동작(…하기) 형태로 씁니다.
 * DB 쪽을 고치지 않고 여기서 옮기는 이유:
 *   - 키가 16개 코드 × 25종으로 닫힌 집합이고 거의 바뀌지 않습니다
 *   - 문구는 화면 문구이므로 copy.ts 와 같은 자리(git)에서 관리하는 편이 낫습니다
 *   - 테이블을 새로 만들면 조회 1회와 RLS 가 더 붙습니다
 *
 * 새 키가 DB 에 생기면 여기에 없더라도 원시 키가 노출되지 않습니다 —
 * focusLabel() 이 null 을 돌려주고 호출부가 다음 후보 문구로 넘어갑니다.
 */

const FOCUS_LABELS: Record<string, string> = {
  // 안정성 · 버티기
  basic_stability: '중심 잡고 버티기',
  core_control: '배에 힘 주고 버티기',
  balance: '균형 잡기',
  dynamic_balance: '움직이면서 균형 잡기',
  single_leg_control: '한 발로 서서 버티기',
  whole_body_control: '온몸 같이 쓰기',
  movement_control: '동작 속도 조절하기',
  movement_quality: '천천히 정확하게 움직이기',

  // 발 · 걷기
  foot_support: '발로 바닥 단단히 딛기',
  foot_control: '발목 흔들리지 않게 잡기',
  gait_pattern: '걷는 자세 다듬기',
  weight_shift: '좌우로 무게 옮겨보기',
  carrying_control: '물건 들 때 자세 잡기',

  // 골반 · 몸통
  pelvic_control: '골반 틀어지지 않게 잡기',
  hip_mobility: '엉덩이·허벅지 풀기',
  rotation_control: '몸통 비틀기 조절하기',
  rotation_mobility: '몸통 돌리는 범위 넓히기',
  cross_body_control: '팔다리 엇갈려 움직이기',

  // 어깨 · 등
  scapular_control: '어깨 뒤로 모아 잡기',
  thoracic_mobility: '굽은 등 펴기',
  upper_body_mobility: '상체 부드럽게 풀기',

  // 하체 · 전신 풀기
  lower_body_mobility: '하체 부드럽게 풀기',
  gentle_mobility: '가볍게 몸 풀기',
  dynamic_mobility: '움직이면서 관절 풀기',

  // 호흡
  breathing: '숨 고르게 쉬기',
}

/**
 * @returns 사용자에게 보여줄 문구. 모르는 키면 null — 호출부가 다른 문구로 넘어갑니다.
 *          **원시 키를 그대로 돌려주지 않습니다.**
 */
export function focusLabel(key?: string | null): string | null {
  if (!key) return null
  const trimmed = key.trim()
  if (!trimmed) return null
  const hit = FOCUS_LABELS[trimmed] ?? FOCUS_LABELS[trimmed.toLowerCase()]
  if (hit) return hit
  // 이미 한글이면(운영에서 직접 넣은 문구) 그대로 씁니다.
  if (/[가-힣]/.test(trimmed)) return trimmed
  return null
}

/** 테스트·점검용 — DB 키가 전부 덮였는지 확인할 때 씁니다. */
export const KNOWN_FOCUS_KEYS = Object.keys(FOCUS_LABELS)
