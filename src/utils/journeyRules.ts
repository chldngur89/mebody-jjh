/**
 * MEBODY Journey — Rule-Based 미션 추천 (V1)
 *
 * 순수 함수만 둡니다. Supabase·React·DOM 의존이 없어 단독으로 검증할 수 있습니다.
 *
 * 설계 원칙
 *  - 16개 코드 × 14일 프로그램을 하드코딩하지 않습니다.
 *  - 입력(body_code / axis / axis_score / priority / day / feedback / duration)으로 조합합니다.
 *  - 같은 입력이면 항상 같은 결과가 나옵니다(AI 없음, 난수 없음).
 *
 * 자세한 근거: docs/MEBODY_JOURNEY_TECH_DESIGN.md 6장
 */

export type JourneyAxisKey = 'neck' | 'shoulder' | 'pelvis' | 'lower'
export type MissionType = 'release' | 'stretch' | 'combo'
export type MissionFeeling = 'BETTER' | 'SAME' | 'UNCOMFORTABLE'
export type MissionDifficultyRating = 'EASY' | 'GOOD' | 'HARD'
export type MissionSourceRule = 'axis_p1' | 'axis_p2' | 'substitute' | 'restart'
export type JourneyDayKind = 'normal' | 'weekly_report' | 'progress_check'

/** 관리 우선순위 1건. user_journeys.axis_priority 에 스냅샷으로 저장됩니다. */
export interface AxisPriorityEntry {
  rank: number
  axis: JourneyAxisKey
  direction: string
  percent: number
  label: string
}

/**
 * codePlanShared 의 AxisRow 가 구조적으로 만족하는 최소 입력.
 * 컴포넌트를 import 하지 않기 위해 형태만 받습니다.
 */
export interface AxisSummaryInput {
  key: string
  axisLookupKey: JourneyAxisKey
  dominantCode: string
  dominantPercent: number
  dominantLabel: string
}

export interface JourneyContentTag {
  content_key: string
  axis_key: JourneyAxisKey | null
  direction_key: string
  body_part_key: string
  mission_type: MissionType
  difficulty: number
  base_duration_sec: number
  equipment: string[]
  is_active: boolean
}

export interface JourneyDaySlotSpec {
  slot_no: number
  axis_rank: number
  mission_type: MissionType
}

export interface JourneyDaySpec {
  day: number
  kind: JourneyDayKind
  slots: JourneyDaySlotSpec[]
}

export interface JourneyDayPlan {
  version?: number
  base_difficulty?: Record<string, number>
  days: JourneyDaySpec[]
}

export interface FeedbackRecord {
  content_key: string
  feeling: MissionFeeling
  difficulty: MissionDifficultyRating
  created_at: string
}

export interface PlannedMission {
  slot_no: number
  content_key: string
  mission_type: MissionType
  planned_duration_sec: number
  difficulty: number
  source_rule: MissionSourceRule
  axis_rank: number
}

export interface SelectDailyMissionsInput {
  dayNo: number
  dayPlan: JourneyDayPlan
  axisPriority: AxisPriorityEntry[]
  contentTags: JourneyContentTag[]
  /** 최신순 정렬된 피드백. 최근 3건만 사용합니다. */
  feedback?: FeedbackRecord[]
  /** 최근 사용한 content_key (최신순). 반복을 피하는 데만 씁니다. */
  recentContentKeys?: string[]
  /** 사용자가 Today 화면에서 고른 가용 시간. 기본 5분 */
  availableMinutes?: number
  lastActiveAt?: string | null
  now?: Date
}

/** codePlanShared.tsx 의 AXIS_TIE_PRIORITY 와 동일한 값 (동점 시 하체 > 골반 > 어깨 > 목) */
const AXIS_TIE_PRIORITY: Record<string, number> = {
  neck: 1,
  shoulder: 2,
  pelvis: 3,
  flexibility: 4,
}

/** 축 → 대체 가능한 body_part_key 후보 (축 콘텐츠가 전부 제외됐을 때 사용) */
const AXIS_TO_BODY_PARTS: Record<JourneyAxisKey, string[]> = {
  neck: ['neck'],
  shoulder: ['shoulder', 'back'],
  pelvis: ['pelvis', 'waist'],
  lower: ['knee', 'ankle', 'foot'],
}

const DEFAULT_AVAILABLE_MINUTES = 5
const RESTART_THRESHOLD_DAYS = 3
const FEEDBACK_WINDOW = 3
const RECENT_CONTENT_WINDOW = 3
const KST_OFFSET_MINUTES = 540

/** mission_type 별 실제 소요 시간. combo = 이완 90초 + 스트레칭 30초 x 3세트 */
export function durationForMissionType(tag: JourneyContentTag, missionType: MissionType): number {
  if (missionType === 'combo') return tag.base_duration_sec
  return Math.max(30, Math.round(tag.base_duration_sec / 2))
}

/**
 * 관리 우선순위 스냅샷을 만듭니다.
 * 정렬 규칙은 codePlanShared 의 getSortedAxisCandidates 와 동일합니다.
 */
export function buildAxisPriority(axisRows: AxisSummaryInput[]): AxisPriorityEntry[] {
  return [...axisRows]
    .sort((left, right) => {
      if (right.dominantPercent !== left.dominantPercent) {
        return right.dominantPercent - left.dominantPercent
      }
      return (AXIS_TIE_PRIORITY[right.key] ?? 0) - (AXIS_TIE_PRIORITY[left.key] ?? 0)
    })
    .map((row, index) => ({
      rank: index + 1,
      axis: row.axisLookupKey,
      direction: row.dominantCode,
      percent: row.dominantPercent,
      label: row.dominantLabel,
    }))
}

/** startedAt 기준 경과 일수 + 1. KST 자정을 하루 경계로 씁니다. */
export function computeCurrentDay(
  startedAt: string | Date,
  now: Date = new Date(),
  durationDays = 14,
): number {
  const start = typeof startedAt === 'string' ? new Date(startedAt) : startedAt
  if (Number.isNaN(start.getTime())) return 1

  const toKstDayIndex = (date: Date) =>
    Math.floor((date.getTime() + KST_OFFSET_MINUTES * 60_000) / 86_400_000)

  const elapsed = toKstDayIndex(now) - toKstDayIndex(start)
  return Math.min(Math.max(elapsed + 1, 1), durationDays)
}

export function daysSince(lastActiveAt: string | null | undefined, now: Date = new Date()): number {
  if (!lastActiveAt) return 0
  const last = new Date(lastActiveAt)
  if (Number.isNaN(last.getTime())) return 0

  const toKstDayIndex = (date: Date) =>
    Math.floor((date.getTime() + KST_OFFSET_MINUTES * 60_000) / 86_400_000)

  return Math.max(0, toKstDayIndex(now) - toKstDayIndex(last))
}

export function getDaySpec(dayPlan: JourneyDayPlan, dayNo: number): JourneyDaySpec | null {
  return dayPlan?.days?.find((day) => day.day === dayNo) ?? null
}

/** day_plan.base_difficulty 의 "1-4": 1 형태를 해석합니다. */
export function baseDifficultyForDay(dayNo: number, dayPlan?: JourneyDayPlan): number {
  const table = dayPlan?.base_difficulty
  if (table) {
    for (const [range, value] of Object.entries(table)) {
      const [fromRaw, toRaw] = range.split('-')
      const from = Number(fromRaw)
      const to = Number(toRaw ?? fromRaw)
      if (Number.isFinite(from) && Number.isFinite(to) && dayNo >= from && dayNo <= to) {
        return clampDifficulty(value)
      }
    }
  }
  if (dayNo <= 4) return 1
  if (dayNo <= 10) return 2
  return 3
}

function clampDifficulty(value: number): number {
  if (!Number.isFinite(value)) return 2
  return Math.min(3, Math.max(1, Math.round(value)))
}

export interface FeedbackSummary {
  /** UNCOMFORTABLE 을 받은 콘텐츠 — 남은 Day 전체에서 제외 */
  excludedContentKeys: Set<string>
  /** BETTER 를 받은 콘텐츠 — 같은 축 안에서 우선 선택 */
  preferredContentKeys: Set<string>
  /** 최근 3건 다수결. 한 번의 답변으로 프로그램이 크게 흔들리지 않게 합니다. */
  difficultyTrend: MissionDifficultyRating
}

export function summarizeFeedback(records: FeedbackRecord[] = []): FeedbackSummary {
  const excludedContentKeys = new Set<string>()
  const preferredContentKeys = new Set<string>()

  for (const record of records) {
    if (record.feeling === 'UNCOMFORTABLE') excludedContentKeys.add(record.content_key)
    if (record.feeling === 'BETTER') preferredContentKeys.add(record.content_key)
  }
  // 불편이 한 번이라도 있었으면 선호보다 제외를 우선합니다.
  for (const key of excludedContentKeys) preferredContentKeys.delete(key)

  const recent = records.slice(0, FEEDBACK_WINDOW)
  const counts: Record<MissionDifficultyRating, number> = { EASY: 0, GOOD: 0, HARD: 0 }
  for (const record of recent) counts[record.difficulty] += 1

  let difficultyTrend: MissionDifficultyRating = 'GOOD'
  if (counts.HARD > counts.EASY && counts.HARD >= counts.GOOD) difficultyTrend = 'HARD'
  else if (counts.EASY > counts.HARD && counts.EASY >= counts.GOOD) difficultyTrend = 'EASY'

  return { excludedContentKeys, preferredContentKeys, difficultyTrend }
}

/** HARD → 한 단계 낮추고, EASY → 한 단계 올립니다. */
export function adjustDifficulty(base: number, trend: MissionDifficultyRating): number {
  if (trend === 'HARD') return clampDifficulty(base - 1)
  if (trend === 'EASY') return clampDifficulty(base + 1)
  return clampDifficulty(base)
}

/** HARD → 0.7배, EASY → 1.2배. 30초 단위로 정리합니다. */
export function scaleDuration(baseSec: number, trend: MissionDifficultyRating): number {
  const factor = trend === 'HARD' ? 0.7 : trend === 'EASY' ? 1.2 : 1
  const scaled = Math.round((baseSec * factor) / 30) * 30
  return Math.max(60, scaled)
}

/** 스트레칭 세트 수. 기본 3세트 */
export function scaleSets(trend: MissionDifficultyRating, baseSets = 3): number {
  if (trend === 'HARD') return Math.max(1, baseSets - 1)
  if (trend === 'EASY') return baseSets + 1
  return baseSets
}

function matchesDirection(tag: JourneyContentTag, direction: string): boolean {
  return tag.direction_key === direction || tag.direction_key === 'both'
}

/**
 * 목표 난이도에 가장 가까운 콘텐츠를 고릅니다.
 * 동점이면 (1) 최근 사용하지 않은 것 (2) BETTER 받은 것 (3) content_key 사전순.
 */
function pickBestTag(
  pool: JourneyContentTag[],
  targetDifficulty: number,
  recentContentKeys: string[],
  preferred: Set<string>,
): JourneyContentTag | null {
  if (pool.length === 0) return null

  const recentIndex = new Map(recentContentKeys.map((key, index) => [key, index]))

  return [...pool].sort((left, right) => {
    const byDifficulty =
      Math.abs(left.difficulty - targetDifficulty) - Math.abs(right.difficulty - targetDifficulty)
    if (byDifficulty !== 0) return byDifficulty

    const leftRecent = recentIndex.has(left.content_key) ? 1 : 0
    const rightRecent = recentIndex.has(right.content_key) ? 1 : 0
    if (leftRecent !== rightRecent) return leftRecent - rightRecent

    const leftPreferred = preferred.has(left.content_key) ? 0 : 1
    const rightPreferred = preferred.has(right.content_key) ? 0 : 1
    if (leftPreferred !== rightPreferred) return leftPreferred - rightPreferred

    return left.content_key.localeCompare(right.content_key)
  })[0]
}

function buildRestartMission(
  axis: AxisPriorityEntry | undefined,
  contentTags: JourneyContentTag[],
  excluded: Set<string>,
): PlannedMission[] {
  const pool = contentTags.filter(
    (tag) =>
      tag.is_active &&
      !excluded.has(tag.content_key) &&
      (axis ? tag.axis_key === axis.axis : true),
  )
  // 복귀 미션은 가장 부담이 적은 것부터
  const picked = pickBestTag(pool.length ? pool : contentTags.filter((t) => t.is_active), 1, [], new Set())
  if (!picked) return []

  return [
    {
      slot_no: 1,
      content_key: picked.content_key,
      mission_type: 'release',
      planned_duration_sec: Math.max(60, Math.round(picked.base_duration_sec / 2)),
      difficulty: 1,
      source_rule: 'restart',
      axis_rank: axis?.rank ?? 1,
    },
  ]
}

/**
 * 하루치 미션을 배정합니다.
 *
 * 0) 3일 이상 미접속 → Restart Mission 1개로 끝냅니다(current_day 는 증가시키지 않습니다).
 * 1) 템플릿 슬롯의 axis_rank 로 대상 축을 정합니다.
 * 2) 해당 축·방향 콘텐츠에서 UNCOMFORTABLE 제외 후 후보를 만듭니다.
 * 3) 후보가 비면 같은 부위의 body_part 콘텐츠로 대체합니다(source_rule = substitute).
 * 4) 최근 피드백으로 목표 난이도와 시간을 조정합니다.
 * 5) 가용 시간을 넘으면 멈춥니다(최소 1개는 배정).
 */
export function selectDailyMissions(input: SelectDailyMissionsInput): PlannedMission[] {
  const {
    dayNo,
    dayPlan,
    axisPriority,
    contentTags,
    feedback = [],
    recentContentKeys = [],
    availableMinutes = DEFAULT_AVAILABLE_MINUTES,
    lastActiveAt = null,
    now = new Date(),
  } = input

  const summary = summarizeFeedback(feedback)
  const activeTags = contentTags.filter((tag) => tag.is_active)

  if (daysSince(lastActiveAt, now) >= RESTART_THRESHOLD_DAYS) {
    return buildRestartMission(axisPriority[0], activeTags, summary.excludedContentKeys)
  }

  const daySpec = getDaySpec(dayPlan, dayNo)
  if (!daySpec || daySpec.slots.length === 0) return []

  const baseDifficulty = baseDifficultyForDay(dayNo, dayPlan)
  const targetDifficulty = adjustDifficulty(baseDifficulty, summary.difficultyTrend)
  const recentWindow = recentContentKeys.slice(0, RECENT_CONTENT_WINDOW)

  const planned: PlannedMission[] = []
  const usedKeys = new Set<string>()
  let remainingSec = Math.max(60, availableMinutes * 60)

  for (const slot of daySpec.slots) {
    const axis = axisPriority[slot.axis_rank - 1] ?? axisPriority[0]
    if (!axis) continue

    let sourceRule: MissionSourceRule = slot.axis_rank === 2 ? 'axis_p2' : 'axis_p1'

    let pool = activeTags.filter(
      (tag) =>
        tag.axis_key === axis.axis &&
        matchesDirection(tag, axis.direction) &&
        !summary.excludedContentKeys.has(tag.content_key) &&
        !usedKeys.has(tag.content_key),
    )

    if (pool.length === 0) {
      const bodyParts = AXIS_TO_BODY_PARTS[axis.axis] ?? []
      pool = activeTags.filter(
        (tag) =>
          bodyParts.includes(tag.body_part_key) &&
          !summary.excludedContentKeys.has(tag.content_key) &&
          !usedKeys.has(tag.content_key),
      )
      if (pool.length > 0) sourceRule = 'substitute'
    }

    const picked = pickBestTag(pool, targetDifficulty, recentWindow, summary.preferredContentKeys)
    if (!picked) continue

    const rawDuration = durationForMissionType(picked, slot.mission_type)
    const duration = scaleDuration(rawDuration, summary.difficultyTrend)
    if (duration > remainingSec && planned.length > 0) break

    planned.push({
      slot_no: slot.slot_no,
      content_key: picked.content_key,
      mission_type: slot.mission_type,
      planned_duration_sec: duration,
      difficulty: targetDifficulty,
      source_rule: sourceRule,
      axis_rank: slot.axis_rank,
    })
    usedKeys.add(picked.content_key)
    remainingSec -= duration
  }

  return planned
}

/** 미션 실행 화면의 한 단계 */
export interface MissionStep {
  key: string
  kind: 'release' | 'stretch'
  title: string
  meta: string
  seconds: number
  lines: string[]
  setIndex?: number
  setTotal?: number
}

/** immediate_action_content 의 필요한 필드만 구조적으로 받습니다. */
export interface MissionContentInput {
  release_title: string
  release_content: string
  release_tool: string
  release_duration_sec: number | null
  stretch_title: string
  stretch_content: string
  stretch_duration_sec: number | null
  sets: number | null
}

export interface MissionStepPlan {
  mission_type: MissionType
  planned_duration_sec: number
}

function splitInstructionLines(text: string): string[] {
  return text
    .split(/\s+\/\s+/)
    .map((step) => step.trim().replace(/^\d+\.\s*/, ''))
    .filter(Boolean)
}

/**
 * 콘텐츠의 자연 시간(이완 90초 + 스트레칭 30초 x 세트)을
 * 배정된 planned_duration_sec 비율로 맞춰 단계 목록을 만듭니다.
 * 스케일은 0.5~1.5 로 제한해 극단적인 시간이 나오지 않게 합니다.
 */
export function buildMissionSteps(content: MissionContentInput, mission: MissionStepPlan): MissionStep[] {
  const releaseSec = content.release_duration_sec ?? 90
  const stretchSec = content.stretch_duration_sec ?? 30
  const sets = Math.max(1, content.sets ?? 3)
  const includeRelease = mission.mission_type !== 'stretch'
  const includeStretch = mission.mission_type !== 'release'

  const naturalTotal = (includeRelease ? releaseSec : 0) + (includeStretch ? stretchSec * sets : 0)
  const rawScale = naturalTotal > 0 ? mission.planned_duration_sec / naturalTotal : 1
  const scale = Math.min(1.5, Math.max(0.5, rawScale))
  const scaled = (seconds: number) => Math.max(10, Math.round((seconds * scale) / 5) * 5)

  const steps: MissionStep[] = []

  if (includeRelease) {
    steps.push({
      key: 'release',
      kind: 'release',
      title: content.release_title || '이완',
      meta: content.release_tool || '맨손',
      seconds: scaled(releaseSec),
      lines: splitInstructionLines(content.release_content || ''),
    })
  }

  if (includeStretch) {
    for (let index = 0; index < sets; index += 1) {
      steps.push({
        key: `stretch-${index}`,
        kind: 'stretch',
        title: content.stretch_title || '스트레칭',
        meta: `${index + 1}세트 / ${sets}세트`,
        seconds: scaled(stretchSec),
        lines: splitInstructionLines(content.stretch_content || ''),
        setIndex: index + 1,
        setTotal: sets,
      })
    }
  }

  return steps
}

export interface ReportMissionInput {
  day_no: number
  content_key: string
  status: 'scheduled' | 'started' | 'completed' | 'skipped'
}

export interface JourneyReportPayload {
  period: { from_day: number; to_day: number }
  completion: { scheduled: number; completed: number; skipped: number; rate: number }
  feeling: Record<MissionFeeling, number>
  difficulty: Record<MissionDifficultyRating, number>
  axis_focus: Record<string, number>
  excluded_content_keys: string[]
  next_hint: string
}

export type NextJourneyKind = 'remeasure' | 'repeat' | 'next_axis' | 'restart_gentle'

export interface NextJourneyRecommendation {
  kind: NextJourneyKind
  title: string
  reason: string
  /** 추천에 따라 다음 저니에서 우선할 축 rank (1 = 지금과 같은 축) */
  focusRank: number
}

/**
 * Day 14 이후 다음 저니를 규칙으로 추천합니다(AI 없음).
 *
 *  완료율 < 40%            -> 부담을 낮춰 같은 저니를 한 번 더
 *  UNCOMFORTABLE 이 1건 이상 -> 재측정으로 현재 상태를 다시 확인
 *  완료율 >= 70% 이고 EASY 우세 -> 2순위 축으로 이동
 *  그 외                    -> 재측정 후 이어가기
 */
export function recommendNextJourney(payload: JourneyReportPayload): NextJourneyRecommendation {
  const rate = payload.completion?.rate ?? 0
  const uncomfortable = payload.feeling?.UNCOMFORTABLE ?? 0
  const easy = payload.difficulty?.EASY ?? 0
  const hard = payload.difficulty?.HARD ?? 0

  if (rate < 40) {
    return {
      kind: 'restart_gentle',
      title: '같은 저니를 더 가볍게 한 번 더',
      reason: '이번 2주는 수행 횟수가 많지 않았습니다. 하루 한 가지만 더 짧게 이어가 보세요.',
      focusRank: 1,
    }
  }

  if (uncomfortable > 0) {
    return {
      kind: 'remeasure',
      title: '재측정으로 지금 상태 다시 확인하기',
      reason: '불편했던 동작이 있었습니다. 32문항을 다시 체크해 현재 기준으로 우선순위를 새로 잡는 것이 안전합니다.',
      focusRank: 1,
    }
  }

  if (rate >= 70 && easy > hard) {
    return {
      kind: 'next_axis',
      title: '2순위 축으로 넘어가기',
      reason: '수행률이 높고 강도도 여유가 있었습니다. 다음 2주는 두 번째 축을 중심으로 진행해 보세요.',
      focusRank: 2,
    }
  }

  return {
    kind: 'remeasure',
    title: '재측정하고 다음 저니 이어가기',
    reason: '2주 동안의 변화를 32문항으로 확인한 뒤 새 우선순위로 이어가는 것을 추천합니다.',
    focusRank: 1,
  }
}

/**
 * 리포트가 집계할 Day 범위.
 *
 *  weekly         : 1 ~ dayNo   (그 주까지)
 *  progress_check : 1 ~ dayNo   (저니 전체)
 *
 * Day 14 화면 문구가 "2주 진척 확인"이므로 2주 전체를 집계합니다.
 * 주간 리포트와 범위가 겹치지만, 최종 요약은 전체를 보는 것이 사용자 기대에 맞습니다.
 */
export function reportRangeFor(reportType: 'weekly' | 'progress_check', dayNo: number): {
  fromDay: number
  toDay: number
} {
  return { fromDay: 1, toDay: Math.max(1, dayNo) }
}

/** Weekly Report / Progress Check 의 payload 를 만듭니다. */
export function buildReportPayload(
  missions: ReportMissionInput[],
  feedback: FeedbackRecord[],
  contentTags: JourneyContentTag[],
  fromDay: number,
  toDay: number,
): JourneyReportPayload {
  const inRange = missions.filter((m) => m.day_no >= fromDay && m.day_no <= toDay)
  const completed = inRange.filter((m) => m.status === 'completed').length
  const skipped = inRange.filter((m) => m.status === 'skipped').length
  const rate = inRange.length > 0 ? Math.round((completed / inRange.length) * 100) : 0

  const feeling: Record<MissionFeeling, number> = { BETTER: 0, SAME: 0, UNCOMFORTABLE: 0 }
  const difficulty: Record<MissionDifficultyRating, number> = { EASY: 0, GOOD: 0, HARD: 0 }
  for (const record of feedback) {
    feeling[record.feeling] += 1
    difficulty[record.difficulty] += 1
  }

  const tagByKey = new Map(contentTags.map((tag) => [tag.content_key, tag]))
  const axisFocus: Record<string, number> = {}
  for (const mission of inRange) {
    const tag = tagByKey.get(mission.content_key)
    const key = tag?.axis_key ?? tag?.body_part_key ?? 'unknown'
    axisFocus[key] = (axisFocus[key] ?? 0) + 1
  }

  const summary = summarizeFeedback(feedback)
  const nextHint =
    summary.difficultyTrend === 'HARD'
      ? '다음 주는 시간과 세트를 줄여 부담을 낮춥니다.'
      : summary.difficultyTrend === 'EASY'
        ? '다음 주는 시간과 세트를 조금 늘립니다.'
        : rate < 50
          ? '다음 주는 하루 한 가지만 짧게 이어가 보세요.'
          : '지금 강도를 유지합니다.'

  return {
    period: { from_day: fromDay, to_day: toDay },
    completion: { scheduled: inRange.length, completed, skipped, rate },
    feeling,
    difficulty,
    axis_focus: axisFocus,
    excluded_content_keys: [...summary.excludedContentKeys],
    next_hint: nextHint,
  }
}
