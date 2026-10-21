/**
 * 네 축의 이름과 좌·우 라벨 — **한 곳에서만 정합니다.**
 *
 * 같은 문구가 네 군데에 흩어져 있었습니다.
 *   · 결과 화면           home/resultData.tsx 의 AXIS_META
 *   · 4축 소개 애니메이션  AxisIntroDemo.tsx
 *   · 저장용 카드 이미지   lib/shareCardImage.ts (호출부가 title 을 넘겨 줌)
 *   · 링크 미리보기 카드   scripts/share-og-card.html
 *
 * 친구 공유 카드가 **다섯 번째**가 되는 참이라 여기로 모읍니다. 라벨이 어긋나면
 * 내 화면과 친구 화면이 같은 축을 다르게 부르게 됩니다.
 *
 * 순서는 코드 글자 순서와 같습니다 — 목(F/C) · 어깨(R/L) · 골반(R/L) · 하체(S/F).
 * 이 순서는 공유 링크의 `ax` 파라미터 순서이기도 하므로 **바꾸면 안 됩니다.**
 */
export type AxisKey = 'neck' | 'shoulder' | 'pelvis' | 'flexibility'

export const AXIS_ORDER: readonly AxisKey[] = ['neck', 'shoulder', 'pelvis', 'flexibility'] as const

export interface AxisLabel {
  /** 결과 화면·카드 이미지의 축 제목 */
  title: string
  /** 좁은 자리용 짧은 이름 */
  short: string
  /** 막대 왼쪽 끝 */
  left: string
  /** 막대 오른쪽 끝 */
  right: string
  /** 왼쪽에 해당하는 코드 글자 */
  leftCode: string
  /** 오른쪽에 해당하는 코드 글자 */
  rightCode: string
}

export const AXIS_LABELS: Record<AxisKey, AxisLabel> = {
  neck: { title: '목 위치', short: '목', left: '전방', right: '중앙', leftCode: 'F', rightCode: 'C' },
  shoulder: { title: '어깨 높이', short: '어깨', left: '오른쪽 높음', right: '왼쪽 높음', leftCode: 'R', rightCode: 'L' },
  pelvis: { title: '골반 회전', short: '골반', left: '오른쪽 회전', right: '왼쪽 회전', leftCode: 'R', rightCode: 'L' },
  flexibility: { title: '하체 유연성', short: '하체', left: '유연', right: '뻣뻣', leftCode: 'F', rightCode: 'S' },
}

/**
 * 막대 손잡이의 위치(0~100, 왼쪽이 0).
 *
 * 축 점수는 "왼쪽으로 얼마나 치우쳤나"(percentLeft)로 들어오는데 막대는 왼쪽부터
 * 그리므로 뒤집습니다. 결과 화면의 knobPercent 와 같은 식입니다 — 두 군데가
 * 어긋나면 내 화면과 친구 화면의 점이 반대로 찍힙니다.
 */
export function knobFromPercentLeft(percentLeft: number): number {
  return Math.max(0, Math.min(100, 100 - percentLeft))
}
