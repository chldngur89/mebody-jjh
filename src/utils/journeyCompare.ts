/**
 * MEBODY Journey — 재측정 전후 비교 (순수 함수)
 *
 * questionnaire_responses.scoring_meta 의 axis/identity 를 대조합니다.
 *
 * 중요: 이 비교는 의료 판단이 아닙니다.
 * "좋아졌다 / 나빠졌다"로 단정하지 않고, 경향 차이가 줄었는지 커졌는지만 중립적으로 표현합니다.
 */

import type { JourneyAxisKey } from './journeyRules'

export type CompareTrend = 'narrowed' | 'widened' | 'similar' | 'flipped'

/** scoring_meta.axis 의 한 축 (bodyCodeCalculator 의 AxisScoreDetail 과 같은 형태) */
export interface ScoringAxisDetail {
  sideA: string
  sideB: string
  scoreA: number
  scoreB: number
  winner: string
  tie?: boolean
  confidence?: string
  maxWeight?: number
}

export interface ScoringMetaLike {
  axis?: Partial<Record<string, ScoringAxisDetail>>
  identity?: Record<string, { raw: number; pct: number }>
  primary_identity?: string
  question_version?: string
}

export interface AxisComparison {
  axis: JourneyAxisKey
  label: string
  beforeWinner: string
  afterWinner: string
  /** 우세 방향이 차지한 비율 (0~100) */
  beforePercent: number
  afterPercent: number
  /** 경향 차이(우세-비우세)의 변화. 음수면 차이가 줄어든 것 */
  deltaPercentPoint: number
  trend: CompareTrend
  message: string
}

export interface JourneyComparison {
  beforeCode: string
  afterCode: string
  changedAxisCount: number
  axes: AxisComparison[]
  identityBefore?: string
  identityAfter?: string
  identityChanged: boolean
  summary: string
}

/** scoring_meta.axis 의 키 → 화면 라벨 */
const AXIS_LABEL: Record<JourneyAxisKey, string> = {
  neck: '목 위치',
  shoulder: '어깨 높이',
  pelvis: '골반 회전',
  lower: '하체 유연성',
}

/** scoring_meta 는 flexibility 키를, Journey 는 lower 키를 씁니다. */
const META_KEY_BY_AXIS: Record<JourneyAxisKey, string> = {
  neck: 'neck',
  shoulder: 'shoulder',
  pelvis: 'pelvis',
  lower: 'flexibility',
}

const AXIS_ORDER: JourneyAxisKey[] = ['neck', 'shoulder', 'pelvis', 'lower']

/**
 * 이 값 이하의 변화는 "비슷하다"로 봅니다.
 *
 * 근거: 축 총점이 가장 작은 목/어깨는 10점입니다. 가중치 1짜리 문항 하나를
 * 다르게 답하면 우세 비율이 10%p 움직이므로, 그 정도는 셀프 체크의 측정 편차로 봅니다.
 * 12%p 는 Primary 앵커(가중치 3) 한 문항이 바뀐 수준(약 30%p)보다 확실히 낮아,
 * 실제 경향 변화만 걸러내기 위한 하한입니다.
 */
const SIMILAR_THRESHOLD_POINT = 12

function dominantPercent(detail: ScoringAxisDetail): number {
  const total = (detail.scoreA ?? 0) + (detail.scoreB ?? 0)
  if (total <= 0) return 50
  return Math.round((Math.max(detail.scoreA, detail.scoreB) / total) * 100)
}

function buildMessage(label: string, trend: CompareTrend, delta: number): string {
  const amount = Math.abs(Math.round(delta))
  if (trend === 'flipped') return `${label} 경향의 방향이 바뀌었습니다.`
  if (trend === 'narrowed') return `${label} 경향 차이가 ${amount}%p 줄었습니다.`
  if (trend === 'widened') return `${label} 경향 차이가 ${amount}%p 늘었습니다.`
  return `${label} 경향은 지난번과 비슷합니다.`
}

export function compareAxis(
  axis: JourneyAxisKey,
  before: ScoringAxisDetail | undefined,
  after: ScoringAxisDetail | undefined,
): AxisComparison | null {
  if (!before || !after) return null

  const label = AXIS_LABEL[axis]
  const beforePercent = dominantPercent(before)
  const afterPercent = dominantPercent(after)
  const flipped = Boolean(before.winner && after.winner && before.winner !== after.winner)

  // 우세 비율은 항상 50 이상이므로, 50 기준 편차의 변화량으로 본다.
  const deltaPercentPoint = afterPercent - beforePercent

  let trend: CompareTrend
  if (flipped) trend = 'flipped'
  else if (Math.abs(deltaPercentPoint) <= SIMILAR_THRESHOLD_POINT) trend = 'similar'
  else if (deltaPercentPoint < 0) trend = 'narrowed'
  else trend = 'widened'

  return {
    axis,
    label,
    beforeWinner: before.winner,
    afterWinner: after.winner,
    beforePercent,
    afterPercent,
    deltaPercentPoint,
    trend,
    message: buildMessage(label, trend, deltaPercentPoint),
  }
}

function buildSummary(axes: AxisComparison[], changedAxisCount: number): string {
  if (axes.length === 0) return '비교할 수 있는 이전 결과가 없습니다.'

  const narrowed = axes.filter((item) => item.trend === 'narrowed').length
  const widened = axes.filter((item) => item.trend === 'widened').length
  const flipped = axes.filter((item) => item.trend === 'flipped').length

  if (changedAxisCount === 0 && narrowed === 0 && widened === 0 && flipped === 0) {
    return '4개 축 모두 지난번과 비슷한 경향입니다.'
  }
  if (narrowed > 0 && narrowed >= widened) {
    return `${narrowed}개 축에서 경향 차이가 줄었습니다. 코드 문자는 ${changedAxisCount}개 축에서 바뀌었습니다.`
  }
  if (widened > 0) {
    return `${widened}개 축에서 경향 차이가 늘었습니다. 생활 환경이나 컨디션의 영향일 수 있습니다.`
  }
  return `${changedAxisCount}개 축에서 코드 문자가 바뀌었습니다.`
}

/**
 * 두 결과의 scoring_meta 를 대조합니다.
 * 한쪽이라도 축 데이터가 없으면 해당 축은 건너뜁니다.
 */
export function compareJourneyResults(
  before: { calculated_code?: string | null; primary_identity?: string | null; scoring_meta?: ScoringMetaLike | null },
  after: { calculated_code?: string | null; primary_identity?: string | null; scoring_meta?: ScoringMetaLike | null },
): JourneyComparison {
  const beforeCode = String(before.calculated_code ?? '')
  const afterCode = String(after.calculated_code ?? '')

  const axes: AxisComparison[] = []
  for (const axis of AXIS_ORDER) {
    const metaKey = META_KEY_BY_AXIS[axis]
    const comparison = compareAxis(
      axis,
      before.scoring_meta?.axis?.[metaKey],
      after.scoring_meta?.axis?.[metaKey],
    )
    if (comparison) axes.push(comparison)
  }

  let changedAxisCount = 0
  if (beforeCode.length === 4 && afterCode.length === 4) {
    for (let index = 0; index < 4; index += 1) {
      if (beforeCode[index] !== afterCode[index]) changedAxisCount += 1
    }
  }

  const identityBefore = before.primary_identity ?? before.scoring_meta?.primary_identity ?? undefined
  const identityAfter = after.primary_identity ?? after.scoring_meta?.primary_identity ?? undefined

  return {
    beforeCode,
    afterCode,
    changedAxisCount,
    axes,
    identityBefore: identityBefore ? String(identityBefore) : undefined,
    identityAfter: identityAfter ? String(identityAfter) : undefined,
    identityChanged: Boolean(identityBefore && identityAfter && identityBefore !== identityAfter),
    summary: buildSummary(axes, changedAxisCount),
  }
}
