/**
 * MEBODY Journey — Supabase 직접 접근 API
 *
 * 원칙
 *  - Spring 서버를 거치지 않습니다. 기존 api/questionnaire.ts · api/account.ts 와 같은 방식입니다.
 *  - 테이블이 아직 없어도(마이그레이션 전) 화면이 죽지 않도록 방어합니다.
 *  - Journey 는 로그인 필수입니다. user_id 는 항상 auth 세션에서 가져옵니다.
 *
 * 자세한 근거: docs/MEBODY_JOURNEY_TECH_DESIGN.md 5·6장
 */

import { supabase } from '../lib/supabase'
import {
  compareJourneyResults,
  type JourneyComparison,
  type ScoringMetaLike,
} from '../utils/journeyCompare'
import {
  buildAxisPriority,
  buildReportPayload,
  computeCurrentDay,
  getDaySpec,
  reportRangeFor,
  selectDailyMissions,
  type AxisPriorityEntry,
  type AxisSummaryInput,
  type FeedbackRecord,
  type JourneyContentTag,
  type JourneyDayKind,
  type JourneyDayPlan,
  type JourneyReportPayload,
  type MissionDifficultyRating,
  type MissionFeeling,
  type MissionType,
  type PlannedMission,
} from '../utils/journeyRules'

export const DEFAULT_TEMPLATE_CODE = 'starter_14d'

export type JourneyStatus = 'active' | 'completed' | 'abandoned'
export type UserMissionStatus = 'scheduled' | 'started' | 'completed' | 'skipped'
export type JourneyReportType = 'weekly' | 'progress_check'

export interface JourneyTemplate {
  code: string
  name: string
  description: string
  duration_days: number
  day_plan: JourneyDayPlan
}

export interface UserJourney {
  id: string
  user_id: string
  questionnaire_response_id: string | null
  template_code: string
  body_code: string | null
  axis_priority: AxisPriorityEntry[]
  status: JourneyStatus
  current_day: number
  started_at: string
  last_active_at: string
  completed_at: string | null
}

export interface UserMission {
  id: string
  user_journey_id: string
  user_id: string
  day_no: number
  slot_no: number
  content_key: string
  mission_type: MissionType
  planned_duration_sec: number
  difficulty: number
  source_rule: string | null
  status: UserMissionStatus
  started_at: string | null
  completed_at: string | null
}

export interface JourneyReport {
  id: string
  user_journey_id: string
  report_type: JourneyReportType
  day_no: number
  payload: JourneyReportPayload
  created_at: string
}

/** 마이그레이션 전이거나 권한이 없을 때 화면을 막지 않기 위한 판별 */
export function isJourneySchemaMissing(error: unknown): boolean {
  const text = String((error as { message?: string } | null)?.message ?? error ?? '').toLowerCase()
  const code = String((error as { code?: string } | null)?.code ?? '')
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    text.includes('does not exist') ||
    text.includes('schema cache')
  )
}

function warn(label: string, error: unknown) {
  if (isJourneySchemaMissing(error)) {
    console.warn(`[journey] ${label}: 스키마가 아직 없습니다. db/journey/*.sql 적용이 필요합니다.`)
    return
  }
  console.warn(`[journey] ${label} failed:`, error)
}

function toAxisPriority(raw: unknown): AxisPriorityEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const entry = item as Record<string, unknown>
      const axis = String(entry.axis ?? '')
      if (axis !== 'neck' && axis !== 'shoulder' && axis !== 'pelvis' && axis !== 'lower') return null
      return {
        rank: Number(entry.rank ?? 0),
        axis,
        direction: String(entry.direction ?? ''),
        percent: Number(entry.percent ?? 0),
        label: String(entry.label ?? ''),
      } satisfies AxisPriorityEntry
    })
    .filter((entry): entry is AxisPriorityEntry => Boolean(entry))
    .sort((left, right) => left.rank - right.rank)
}

function mapJourneyRow(row: Record<string, unknown>): UserJourney {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    questionnaire_response_id: row.questionnaire_response_id ? String(row.questionnaire_response_id) : null,
    template_code: String(row.template_code ?? DEFAULT_TEMPLATE_CODE),
    body_code: row.body_code ? String(row.body_code) : null,
    axis_priority: toAxisPriority(row.axis_priority),
    status: (row.status as JourneyStatus) ?? 'active',
    current_day: Number(row.current_day ?? 1),
    started_at: String(row.started_at),
    last_active_at: String(row.last_active_at ?? row.started_at),
    completed_at: row.completed_at ? String(row.completed_at) : null,
  }
}

function mapMissionRow(row: Record<string, unknown>): UserMission {
  return {
    id: String(row.id),
    user_journey_id: String(row.user_journey_id),
    user_id: String(row.user_id),
    day_no: Number(row.day_no ?? 1),
    slot_no: Number(row.slot_no ?? 1),
    content_key: String(row.content_key ?? ''),
    mission_type: (row.mission_type as MissionType) ?? 'combo',
    planned_duration_sec: Number(row.planned_duration_sec ?? 180),
    difficulty: Number(row.difficulty ?? 2),
    source_rule: row.source_rule ? String(row.source_rule) : null,
    status: (row.status as UserMissionStatus) ?? 'scheduled',
    started_at: row.started_at ? String(row.started_at) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
  }
}

function mapContentTagRow(row: Record<string, unknown>): JourneyContentTag {
  const axis = String(row.axis_key ?? '')
  return {
    content_key: String(row.content_key ?? ''),
    axis_key:
      axis === 'neck' || axis === 'shoulder' || axis === 'pelvis' || axis === 'lower' ? axis : null,
    direction_key: String(row.direction_key ?? 'both'),
    body_part_key: String(row.body_part_key ?? ''),
    mission_type: (row.mission_type as MissionType) ?? 'combo',
    difficulty: Number(row.difficulty ?? 2),
    base_duration_sec: Number(row.base_duration_sec ?? 180),
    equipment: Array.isArray(row.equipment) ? row.equipment.map(String) : [],
    is_active: row.is_active !== false,
  }
}

// ---------------------------------------------------------------------------
// 카탈로그 — 세션 단위 캐시
// ---------------------------------------------------------------------------

let templateCache: JourneyTemplate | null = null
let contentTagsCache: JourneyContentTag[] | null = null

export async function fetchJourneyTemplate(
  code: string = DEFAULT_TEMPLATE_CODE,
): Promise<JourneyTemplate | null> {
  if (templateCache?.code === code) return templateCache

  const { data, error } = await supabase
    .from('journey_templates')
    .select('code, name, description, duration_days, day_plan')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    warn('fetchJourneyTemplate', error)
    return null
  }
  if (!data) return null

  templateCache = {
    code: String(data.code),
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    duration_days: Number(data.duration_days ?? 14),
    day_plan: (data.day_plan as JourneyDayPlan) ?? { days: [] },
  }
  return templateCache
}

export async function fetchJourneyContentTags(): Promise<JourneyContentTag[]> {
  if (contentTagsCache) return contentTagsCache

  const { data, error } = await supabase
    .from('journey_content_tags')
    .select('content_key, axis_key, direction_key, body_part_key, mission_type, difficulty, base_duration_sec, equipment, is_active')
    .eq('is_active', true)

  if (error) {
    warn('fetchJourneyContentTags', error)
    return []
  }

  contentTagsCache = (data ?? []).map((row) => mapContentTagRow(row as Record<string, unknown>))
  return contentTagsCache
}

export function clearJourneyCatalogCache(): void {
  templateCache = null
  contentTagsCache = null
}

// ---------------------------------------------------------------------------
// Journey 수명주기
// ---------------------------------------------------------------------------

export async function fetchActiveJourney(userId: string): Promise<UserJourney | null> {
  if (!userId) return null

  const { data, error } = await supabase
    .from('user_journeys')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    warn('fetchActiveJourney', error)
    return null
  }
  return data ? mapJourneyRow(data as Record<string, unknown>) : null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 비회원 로컬 결과(local-result-*)는 FK 를 걸 수 없으므로 연결하지 않습니다. */
export function isPersistedResultId(resultId: string | undefined | null): boolean {
  return Boolean(resultId && UUID_PATTERN.test(resultId))
}

export interface StartJourneyInput {
  userId: string
  questionnaireResponseId?: string
  bodyCode?: string
  /** codePlanShared 의 axisRows 를 그대로 넘길 수 있습니다. */
  axisRows?: AxisSummaryInput[]
  axisPriority?: AxisPriorityEntry[]
  templateCode?: string
}

/** 이미 진행 중인 Journey 가 있으면 그것을 반환합니다(중복 생성 방지). */
export async function startJourney(input: StartJourneyInput): Promise<UserJourney | null> {
  const { userId } = input
  if (!userId) return null

  const existing = await fetchActiveJourney(userId)
  if (existing) return existing

  const axisPriority = input.axisPriority ?? buildAxisPriority(input.axisRows ?? [])
  const now = new Date().toISOString()

  const payload = {
    user_id: userId,
    questionnaire_response_id: isPersistedResultId(input.questionnaireResponseId)
      ? input.questionnaireResponseId
      : null,
    template_code: input.templateCode ?? DEFAULT_TEMPLATE_CODE,
    body_code: input.bodyCode ?? null,
    axis_priority: axisPriority,
    status: 'active' as const,
    current_day: 1,
    started_at: now,
    last_active_at: now,
  }

  const { data, error } = await supabase.from('user_journeys').insert(payload).select().single()

  if (error) {
    // 동시 시작으로 unique 인덱스에 걸리면 기존 것을 돌려줍니다.
    if (String((error as { code?: string }).code) === '23505') {
      return fetchActiveJourney(userId)
    }
    warn('startJourney', error)
    return null
  }
  return mapJourneyRow(data as Record<string, unknown>)
}

export async function touchJourney(journeyId: string, currentDay?: number): Promise<void> {
  if (!journeyId) return

  const payload: Record<string, unknown> = { last_active_at: new Date().toISOString() }
  if (typeof currentDay === 'number') payload.current_day = currentDay

  const { error } = await supabase.from('user_journeys').update(payload).eq('id', journeyId)
  if (error) warn('touchJourney', error)
}

export async function completeJourney(journeyId: string): Promise<void> {
  if (!journeyId) return
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('user_journeys')
    .update({ status: 'completed', completed_at: now, last_active_at: now })
    .eq('id', journeyId)
  if (error) warn('completeJourney', error)
}

export async function abandonJourney(journeyId: string): Promise<void> {
  if (!journeyId) return
  const { error } = await supabase
    .from('user_journeys')
    .update({ status: 'abandoned', last_active_at: new Date().toISOString() })
    .eq('id', journeyId)
  if (error) warn('abandonJourney', error)
}

// ---------------------------------------------------------------------------
// 미션
// ---------------------------------------------------------------------------

export async function fetchMissionsForJourney(journeyId: string): Promise<UserMission[]> {
  if (!journeyId) return []

  const { data, error } = await supabase
    .from('user_missions')
    .select('*')
    .eq('user_journey_id', journeyId)
    .order('day_no', { ascending: true })
    .order('slot_no', { ascending: true })

  if (error) {
    warn('fetchMissionsForJourney', error)
    return []
  }
  return (data ?? []).map((row) => mapMissionRow(row as Record<string, unknown>))
}

export async function fetchRecentFeedback(userId: string, limit = 10): Promise<FeedbackRecord[]> {
  if (!userId) return []

  const { data, error } = await supabase
    .from('journey_mission_feedback')
    .select('feeling, difficulty, created_at, user_missions!inner(content_key)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    warn('fetchRecentFeedback', error)
    return []
  }

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>
    const joined = record.user_missions as { content_key?: unknown } | { content_key?: unknown }[] | null
    const contentKey = Array.isArray(joined) ? joined[0]?.content_key : joined?.content_key
    return {
      content_key: String(contentKey ?? ''),
      feeling: (record.feeling as MissionFeeling) ?? 'SAME',
      difficulty: (record.difficulty as MissionDifficultyRating) ?? 'GOOD',
      created_at: String(record.created_at ?? ''),
    }
  })
}

export interface TodayMissionsResult {
  journey: UserJourney
  dayNo: number
  dayKind: JourneyDayKind
  missions: UserMission[]
  isRestart: boolean
}

/**
 * 오늘의 미션을 보장합니다. 이미 배정된 Day 면 그대로 읽고, 없으면 규칙으로 만들어 저장합니다.
 * 같은 Day 를 다시 열어도 미션이 바뀌지 않습니다(멱등).
 */
export async function ensureDayMissions(
  journey: UserJourney,
  options: { availableMinutes?: number; now?: Date } = {},
): Promise<TodayMissionsResult | null> {
  const now = options.now ?? new Date()

  const [template, contentTags, allMissions, feedback] = await Promise.all([
    fetchJourneyTemplate(journey.template_code),
    fetchJourneyContentTags(),
    fetchMissionsForJourney(journey.id),
    fetchRecentFeedback(journey.user_id),
  ])

  if (!template || contentTags.length === 0) return null

  const dayNo = computeCurrentDay(journey.started_at, now, template.duration_days)
  const existing = allMissions.filter((mission) => mission.day_no === dayNo)
  const dayKind = getDaySpec(template.day_plan, dayNo)?.kind ?? 'normal'

  if (existing.length > 0) {
    return {
      journey,
      dayNo,
      dayKind,
      missions: existing,
      isRestart: existing.some((mission) => mission.source_rule === 'restart'),
    }
  }

  const recentContentKeys = allMissions
    .filter((mission) => mission.day_no < dayNo)
    .sort((left, right) => right.day_no - left.day_no)
    .map((mission) => mission.content_key)

  const planned = selectDailyMissions({
    dayNo,
    dayPlan: template.day_plan,
    axisPriority: journey.axis_priority,
    contentTags,
    feedback,
    recentContentKeys,
    availableMinutes: options.availableMinutes,
    lastActiveAt: journey.last_active_at,
    now,
  })

  if (planned.length === 0) {
    return { journey, dayNo, dayKind, missions: [], isRestart: false }
  }

  const inserted = await insertPlannedMissions(journey, dayNo, planned)
  await touchJourney(journey.id, dayNo)

  return {
    journey,
    dayNo,
    dayKind,
    missions: inserted,
    isRestart: planned.some((mission) => mission.source_rule === 'restart'),
  }
}

async function insertPlannedMissions(
  journey: UserJourney,
  dayNo: number,
  planned: PlannedMission[],
): Promise<UserMission[]> {
  const rows = planned.map((mission) => ({
    user_journey_id: journey.id,
    user_id: journey.user_id,
    day_no: dayNo,
    slot_no: mission.slot_no,
    content_key: mission.content_key,
    mission_type: mission.mission_type,
    planned_duration_sec: mission.planned_duration_sec,
    difficulty: mission.difficulty,
    source_rule: mission.source_rule,
    status: 'scheduled' as const,
  }))

  const { data, error } = await supabase
    .from('user_missions')
    .upsert(rows, { onConflict: 'user_journey_id,day_no,slot_no', ignoreDuplicates: true })
    .select()

  if (error) {
    warn('insertPlannedMissions', error)
    return []
  }

  if (!data || data.length === 0) {
    // ignoreDuplicates 로 아무것도 반환되지 않으면 이미 있는 행을 읽어옵니다.
    const all = await fetchMissionsForJourney(journey.id)
    return all.filter((mission) => mission.day_no === dayNo)
  }

  return data
    .map((row) => mapMissionRow(row as Record<string, unknown>))
    .sort((left, right) => left.slot_no - right.slot_no)
}

export async function startMission(missionId: string): Promise<void> {
  if (!missionId) return
  const { error } = await supabase
    .from('user_missions')
    .update({ status: 'started', started_at: new Date().toISOString() })
    .eq('id', missionId)
    .eq('status', 'scheduled')
  if (error) warn('startMission', error)
}

export async function completeMission(missionId: string): Promise<void> {
  if (!missionId) return
  const { error } = await supabase
    .from('user_missions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', missionId)
  if (error) warn('completeMission', error)
}

export async function skipMission(missionId: string): Promise<void> {
  if (!missionId) return
  const { error } = await supabase
    .from('user_missions')
    .update({ status: 'skipped' })
    .eq('id', missionId)
    .neq('status', 'completed')
  if (error) warn('skipMission', error)
}

export interface SaveMissionFeedbackInput {
  missionId: string
  userId: string
  feeling: MissionFeeling
  difficulty: MissionDifficultyRating
  note?: string
}

export async function saveMissionFeedback(input: SaveMissionFeedbackInput): Promise<boolean> {
  const { missionId, userId, feeling, difficulty, note } = input
  if (!missionId || !userId) return false

  const { error } = await supabase.from('journey_mission_feedback').upsert(
    {
      user_mission_id: missionId,
      user_id: userId,
      feeling,
      difficulty,
      note: note ?? null,
    },
    { onConflict: 'user_mission_id' },
  )

  if (error) {
    warn('saveMissionFeedback', error)
    return false
  }
  return true
}

export interface TodayProgressSummary {
  journeyId: string
  dayNo: number
  totalDays: number
  total: number
  completed: number
  progress: number
}

/**
 * 코드 플랜 등 Journey 밖 화면에서 쓰는 읽기 전용 요약입니다.
 * ensureDayMissions 와 달리 미션을 생성하지 않습니다(쓰기 없음).
 */
export async function fetchTodayProgressSummary(userId: string): Promise<TodayProgressSummary | null> {
  if (!userId) return null

  const journey = await fetchActiveJourney(userId)
  if (!journey) return null

  const template = await fetchJourneyTemplate(journey.template_code)
  const totalDays = template?.duration_days ?? 14
  const dayNo = computeCurrentDay(journey.started_at, new Date(), totalDays)

  const missions = await fetchMissionsForJourney(journey.id)
  const todayMissions = missions.filter((mission) => mission.day_no === dayNo)

  return {
    journeyId: journey.id,
    dayNo,
    totalDays,
    total: todayMissions.length,
    completed: todayMissions.filter((mission) => mission.status === 'completed').length,
    progress: calculateDayProgress(todayMissions),
  }
}

/** 오늘 배정된 미션 중 완료 비율 (0~100). 코드 플랜의 미션 수행률 UI 에 넣을 값입니다. */
export function calculateDayProgress(missions: UserMission[]): number {
  if (missions.length === 0) return 0
  const completed = missions.filter((mission) => mission.status === 'completed').length
  return Math.round((completed / missions.length) * 100)
}

// ---------------------------------------------------------------------------
// 적립금
//
// 금액은 항상 서버(Postgres 함수)가 정합니다. 클라이언트는 "요청"만 하고
// 원장에 직접 쓸 권한이 없습니다. 여기서 금액을 계산하거나 보정하면 안 됩니다.
// ---------------------------------------------------------------------------

export interface RewardRule {
  code: string
  display_label: string
  disclosure: string
  min_amount: number | null
  max_amount: number | null
  fixed_amount: number | null
}

export interface RewardClaim {
  amount: number
  alreadyClaimed: boolean
  balance: number
  /** 구독 등급 적립 배수. 1이면 혜택 없음 */
  multiplier?: number
}

let rewardRulesCache: RewardRule[] | null = null

/** 확률 고지를 화면에 노출하기 위한 규칙 조회 */
export async function fetchRewardRules(): Promise<RewardRule[]> {
  if (rewardRulesCache) return rewardRulesCache

  const { data, error } = await supabase
    .from('reward_rules')
    .select('code, display_label, disclosure, min_amount, max_amount, fixed_amount')
    .eq('is_active', true)

  if (error) {
    warn('fetchRewardRules', error)
    return []
  }
  rewardRulesCache = (data ?? []) as RewardRule[]
  return rewardRulesCache
}

function mapClaim(row: Record<string, unknown> | null | undefined): RewardClaim | null {
  if (!row) return null
  return {
    amount: Number(row.amount ?? 0),
    alreadyClaimed: row.already_claimed === true,
    balance: Number(row.balance ?? 0),
    multiplier: row.multiplier === undefined ? undefined : Number(row.multiplier),
  }
}

/** 미션 완료 적립. 이미 받았으면 alreadyClaimed=true 로 같은 금액을 돌려줍니다. */
export async function claimMissionReward(missionId: string): Promise<RewardClaim | null> {
  if (!missionId) return null

  const { data, error } = await supabase.rpc('claim_mission_reward', { p_mission_id: missionId })
  if (error) {
    warn('claimMissionReward', error)
    return null
  }
  return mapClaim(Array.isArray(data) ? data[0] : (data as Record<string, unknown>))
}

/** 14일 완주 보너스. 저니가 completed 여야 지급됩니다. */
export async function claimJourneyReward(journeyId: string): Promise<RewardClaim | null> {
  if (!journeyId) return null

  const { data, error } = await supabase.rpc('claim_journey_reward', { p_journey_id: journeyId })
  if (error) {
    warn('claimJourneyReward', error)
    return null
  }
  return mapClaim(Array.isArray(data) ? data[0] : (data as Record<string, unknown>))
}

export async function fetchRewardBalance(userId: string): Promise<number> {
  if (!userId) return 0

  const { data, error } = await supabase
    .from('user_rewards')
    .select('amount')
    .eq('user_id', userId)

  if (error) {
    warn('fetchRewardBalance', error)
    return 0
  }
  return (data ?? []).reduce((sum, row) => sum + Number((row as { amount?: unknown }).amount ?? 0), 0)
}

// ---------------------------------------------------------------------------
// 재측정 비교
// ---------------------------------------------------------------------------

interface ComparableResultRow {
  id: string
  calculated_code: string | null
  primary_identity: string | null
  scoring_meta: ScoringMetaLike | null
  completed_at: string | null
}

async function fetchComparableResult(resultId: string): Promise<ComparableResultRow | null> {
  if (!isPersistedResultId(resultId)) return null

  const { data, error } = await supabase
    .from('questionnaire_responses')
    .select('id, calculated_code, primary_identity, scoring_meta, completed_at')
    .eq('id', resultId)
    .maybeSingle()

  if (error || !data) {
    if (error) warn('fetchComparableResult', error)
    return null
  }
  return data as ComparableResultRow
}

/** 가장 최근 완료된 저니 1건 (재측정 비교의 기준점) */
export async function fetchLastCompletedJourney(userId: string): Promise<UserJourney | null> {
  if (!userId) return null

  const { data, error } = await supabase
    .from('user_journeys')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    warn('fetchLastCompletedJourney', error)
    return null
  }
  return data ? mapJourneyRow(data as Record<string, unknown>) : null
}

/**
 * 저니 시작 시점 결과와 이후 결과를 대조합니다.
 * 두 결과가 같거나 한쪽이 없으면 null 을 돌려주고, 화면은 비교 카드를 감춥니다.
 */
export async function fetchJourneyComparison(
  beforeResultId: string | null | undefined,
  afterResultId: string | null | undefined,
): Promise<JourneyComparison | null> {
  if (!beforeResultId || !afterResultId || beforeResultId === afterResultId) return null

  const [before, after] = await Promise.all([
    fetchComparableResult(beforeResultId),
    fetchComparableResult(afterResultId),
  ])
  if (!before || !after) return null
  if (!before.scoring_meta?.axis || !after.scoring_meta?.axis) return null

  return compareJourneyResults(before, after)
}

// ---------------------------------------------------------------------------
// 리포트
// ---------------------------------------------------------------------------

export async function fetchReport(
  journeyId: string,
  reportType: JourneyReportType,
  dayNo: number,
): Promise<JourneyReport | null> {
  if (!journeyId) return null

  const { data, error } = await supabase
    .from('journey_reports')
    .select('*')
    .eq('user_journey_id', journeyId)
    .eq('report_type', reportType)
    .eq('day_no', dayNo)
    .maybeSingle()

  if (error) {
    warn('fetchReport', error)
    return null
  }
  if (!data) return null

  const row = data as Record<string, unknown>
  return {
    id: String(row.id),
    user_journey_id: String(row.user_journey_id),
    report_type: row.report_type as JourneyReportType,
    day_no: Number(row.day_no ?? 0),
    payload: (row.payload as JourneyReportPayload) ?? ({} as JourneyReportPayload),
    created_at: String(row.created_at),
  }
}

/** 이미 있으면 그대로 반환합니다(UNIQUE 제약과 함께 중복 생성 방지). */
export async function buildReport(
  journey: UserJourney,
  reportType: JourneyReportType,
  dayNo: number,
): Promise<JourneyReport | null> {
  const existing = await fetchReport(journey.id, reportType, dayNo)
  if (existing) return existing

  const [missions, feedback, contentTags] = await Promise.all([
    fetchMissionsForJourney(journey.id),
    fetchRecentFeedback(journey.user_id, 50),
    fetchJourneyContentTags(),
  ])

  const { fromDay, toDay } = reportRangeFor(reportType, dayNo)
  const payload = buildReportPayload(missions, feedback, contentTags, fromDay, toDay)

  const { data, error } = await supabase
    .from('journey_reports')
    .insert({
      user_journey_id: journey.id,
      user_id: journey.user_id,
      report_type: reportType,
      day_no: dayNo,
      payload,
    })
    .select()
    .single()

  if (error) {
    if (String((error as { code?: string }).code) === '23505') {
      return fetchReport(journey.id, reportType, dayNo)
    }
    warn('buildReport', error)
    return null
  }

  const row = data as Record<string, unknown>
  return {
    id: String(row.id),
    user_journey_id: String(row.user_journey_id),
    report_type: reportType,
    day_no: dayNo,
    payload,
    created_at: String(row.created_at),
  }
}

export type { JourneyComparison }
export type { AxisPriorityEntry, JourneyContentTag, JourneyReportPayload, MissionType }
