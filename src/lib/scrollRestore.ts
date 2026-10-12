/**
 * 탭을 다시 열었을 때 **어디로 되돌릴 것인가.**
 *
 * ── 왜 함수로 뺐나
 * 이 한 줄이 틀려서 스크롤 복원이 통째로 죽어 있었습니다(2026-10-12 실측).
 * 컴포넌트 안에 있으면 눈으로 봐서는 멀쩡해 보이고 검증할 방법도 없습니다.
 *
 * ── 무엇이 틀렸었나
 *   if (scrollHeight - clientHeight < saved) return   // 아직 안 자랐다고 보고 기다림
 *
 * `scrollHeight`·`clientHeight` 는 **정수**인데 `scrollTop` 은 **소수**입니다.
 * 맨 아래까지 내리면 저장값이 2438.095 가 되고 최대값은 2438 이라, 영원히
 * "아직 덜 자랐다" 로 읽혀 한 번도 복원되지 않았습니다. 2.5초 뒤 포기 타이머가
 * 돌면서 조용히 끝나서, 증상은 "마켓에 다시 들어가면 맨 위" 뿐이었습니다.
 * 하필 **끝까지 내려본 사람**에게만 생깁니다 — 상품을 다 본 사람입니다.
 */

/** 1px 은 소수점 반올림 오차입니다. 내용이 덜 자란 것과 구분해야 합니다. */
const ROUNDING_SLACK = 1

/**
 * 돌려줄 값이 숫자면 그 위치로 보내고 복원을 끝냅니다.
 * null 이면 **아직 기다립니다** — 내용이 그만큼 자라지 않았다는 뜻입니다.
 *
 * 되돌릴 수 있는 최대치를 넘어가면 최대치로 깎습니다. 브라우저도 어차피 깎지만,
 * 깎인 값을 그대로 쓰면 다음 저장이 또 최대치를 넘지 않습니다.
 */
export function scrollRestoreTarget(scrollHeight: number, clientHeight: number, saved: number): number | null {
  if (!(saved > 0)) return 0
  const max = scrollHeight - clientHeight
  if (max <= 0) return null
  if (max + ROUNDING_SLACK < saved) return null
  return Math.min(saved, max)
}
