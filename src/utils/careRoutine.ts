/**
 * MEBODY 15분 케어 루틴 (순수 함수)
 *
 * 기존 루틴은 body_code_content.exercises 를 썼는데, 그 데이터는 16개 코드가
 * 4가지 조합만 쓰고 목·어깨 축만 반영합니다. 골반이나 하체가 1순위인 사용자도
 * 루틴에는 그 축이 나타나지 않았습니다.
 *
 * 여기서는 immediate_action_axis_mapping(8행) + immediate_action_content(23행) 로
 * 4축을 모두 반영해 루틴을 조합합니다. 두 테이블 모두 이미 운영에 있으므로
 * Journey 마이그레이션 없이도 동작합니다.
 *
 * 규칙
 *  1) 순서는 항상 해부학적 위쪽 → 아래쪽: 목(1) → 어깨(2) → 골반(3) → 하체(4)
 *     우선순위가 높다고 순서를 앞으로 당기지 않습니다. 순서는 몸의 위치를 따릅니다.
 *  2) 우선순위는 "시간"으로 반영합니다. 1순위 축 +2세트, 2순위 축 +1세트.
 *  3) 남는 시간은 마무리 정렬 체크로 채워 총 15분을 맞춥니다.
 */

export const CARE_ROUTINE_TOTAL_SEC = 900 // 15분

export type CareAxisKey = 'neck' | 'shoulder' | 'pelvis' | 'lower'

/** codePlanShared 의 AxisRow 가 구조적으로 만족하는 최소 입력 */
export interface CareAxisInput {
  axisLookupKey: CareAxisKey
  axisNo: number
  title: string
  dominantCode: string
  dominantLabel: string
  dominantPercent: number
}

export interface CareAxisMappingInput {
  axis_no: number
  axis_key: string
  direction_key: string
  display_name: string
  release_content_key: string
  stretch_content_key: string
  is_active: boolean
}

export interface CareContentInput {
  content_key: string
  display_name: string
  target_muscle: string
  release_title: string
  release_content: string
  release_tool: string
  release_duration_sec: number | null
  stretch_title: string
  stretch_content: string
  stretch_duration_sec: number | null
  sets: number | null
  caution: string
  release_image_url?: string
  stretch_image_url?: string
}

export interface CareRoutineStep {
  kind: 'axis' | 'finish'
  order: number
  axis?: CareAxisKey
  axisNo?: number
  axisLabel?: string
  title: string
  contentKey?: string
  targetMuscle?: string
  tool?: string
  releaseSec?: number
  stretchSec?: number
  sets?: number
  durationSec: number
  /** 1 또는 2면 우선순위 축. 세트가 늘어난 이유를 화면에서 설명하는 데 씁니다. */
  priorityRank?: number
  releaseSteps?: string[]
  stretchSteps?: string[]
  releaseImageUrl?: string
  stretchImageUrl?: string
  desc?: string
  caution?: string
}

export interface CareRoutine {
  steps: CareRoutineStep[]
  totalSec: number
  /** 4축이 모두 채워졌는지. 하나라도 빠지면 화면에서 안내할 수 있습니다. */
  coversAllAxes: boolean
}

const BASE_SETS = 3
const PRIORITY_BONUS_SETS: Record<number, number> = { 1: 2, 2: 1 }
const MIN_FINISH_SEC = 30

function splitSteps(text: string): string[] {
  return String(text ?? '')
    .split(/\s+\/\s+/)
    .map((step) => step.trim().replace(/^\d+\.\s*/, ''))
    .filter(Boolean)
}

function findMapping(
  mappings: CareAxisMappingInput[],
  axis: CareAxisInput,
): CareAxisMappingInput | undefined {
  return mappings.find(
    (mapping) =>
      mapping.is_active &&
      mapping.axis_key === axis.axisLookupKey &&
      mapping.direction_key === axis.dominantCode,
  )
}

/**
 * 루틴을 조합합니다.
 *
 * @param axisRows      4축 결과 (순서 무관 — 내부에서 axisNo 오름차순 정렬)
 * @param priorityOrder 우선순위가 높은 축부터 나열한 축 키. 시간 배분에만 씁니다.
 */
export function buildCareRoutine(
  axisRows: CareAxisInput[],
  mappings: CareAxisMappingInput[],
  contents: CareContentInput[],
  priorityOrder: CareAxisKey[] = [],
): CareRoutine {
  const contentByKey = new Map(contents.map((content) => [content.content_key, content]))
  const rankByAxis = new Map(priorityOrder.map((axis, index) => [axis, index + 1]))

  // 순서는 언제나 위 → 아래
  const ordered = [...axisRows].sort((left, right) => left.axisNo - right.axisNo)

  const steps: CareRoutineStep[] = []
  let order = 0

  for (const axis of ordered) {
    const mapping = findMapping(mappings, axis)
    if (!mapping) continue

    const content =
      contentByKey.get(mapping.release_content_key) ?? contentByKey.get(mapping.stretch_content_key)
    if (!content) continue

    // 보너스가 붙는 1·2순위만 우선순위로 표시한다 (3·4순위 배지는 의미가 없음)
    const resolvedRank = rankByAxis.get(axis.axisLookupKey)
    const rank = resolvedRank && PRIORITY_BONUS_SETS[resolvedRank] ? resolvedRank : undefined
    const sets = BASE_SETS + (rank ? PRIORITY_BONUS_SETS[rank] : 0)
    const releaseSec = content.release_duration_sec ?? 90
    const stretchSec = content.stretch_duration_sec ?? 30

    order += 1
    steps.push({
      kind: 'axis',
      order,
      axis: axis.axisLookupKey,
      axisNo: axis.axisNo,
      axisLabel: axis.title,
      title: content.display_name || mapping.display_name,
      contentKey: content.content_key,
      targetMuscle: content.target_muscle,
      tool: content.release_tool,
      releaseSec,
      stretchSec,
      sets,
      durationSec: releaseSec + stretchSec * sets,
      priorityRank: rank,
      releaseSteps: splitSteps(content.release_content),
      stretchSteps: splitSteps(content.stretch_content),
      releaseImageUrl: content.release_image_url || undefined,
      stretchImageUrl: content.stretch_image_url || undefined,
      caution: content.caution,
    })
  }

  if (steps.length === 0) {
    return { steps: [], totalSec: 0, coversAllAxes: false }
  }

  const axisTotal = steps.reduce((sum, step) => sum + step.durationSec, 0)
  const remaining = CARE_ROUTINE_TOTAL_SEC - axisTotal

  if (remaining >= MIN_FINISH_SEC) {
    steps.push({
      kind: 'finish',
      order: steps.length + 1,
      title: '마무리 정렬 체크',
      durationSec: remaining,
      desc: '호흡을 정리하면서 목, 어깨, 골반, 하체 순서로 위치를 다시 가볍게 확인합니다.',
    })
  }

  return {
    steps,
    totalSec: steps.reduce((sum, step) => sum + step.durationSec, 0),
    coversAllAxes: steps.filter((step) => step.kind === 'axis').length === 4,
  }
}

/** "3분 30초" 형태로 표기 */
export function formatRoutineDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes === 0) return `${rest}초`
  if (rest === 0) return `${minutes}분`
  return `${minutes}분 ${rest}초`
}
