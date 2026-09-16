/**
 * 두 mebody Code(4글자)의 축 비교.
 * 글자 순서: 목(F/C) · 어깨(R/L) · 골반(R/L) · 하체(S/F)
 */

export const AXIS_LABELS = ['목', '어깨', '골반', '하체'] as const

export interface AxisCompareRow {
  axis: (typeof AXIS_LABELS)[number]
  index: number
  mine: string
  friend: string
  same: boolean
}

export interface BodyCodeCompare {
  sameCount: number
  differentCount: number
  rows: AxisCompareRow[]
}

export function compareBodyCodes(mine: string, friend: string): BodyCodeCompare | null {
  const a = mine.trim().toUpperCase()
  const b = friend.trim().toUpperCase()
  if (!/^[FC][RL][RL][SF]$/.test(a) || !/^[FC][RL][RL][SF]$/.test(b)) return null

  const rows: AxisCompareRow[] = AXIS_LABELS.map((axis, index) => ({
    axis,
    index,
    mine: a[index],
    friend: b[index],
    same: a[index] === b[index],
  }))

  const sameCount = rows.filter((row) => row.same).length
  return {
    sameCount,
    differentCount: 4 - sameCount,
    rows,
  }
}
