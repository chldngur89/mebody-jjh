/**
 * 마이 바디 노트 — 사용자가 직접 적는 하루 몸 상태.
 *
 * 미션 피드백과 **역할이 다릅니다.** 섞으면 사용자가 같은 걸 두 번 적게 되고
 * 두 숫자가 어긋나기 시작합니다.
 *
 *   미션 피드백 = 방금 한 동작이 어땠나 (ACTION RESPONSE)
 *   바디 노트   = 오늘 내 몸과 생활이 어땠나 (DAILY STATE)
 *
 * 서버(Spring)를 거치지 않고 Supabase 를 직접 씁니다. 조건이 "내 것" 한 줄이라
 * RLS 로 충분하고(074), 서버를 거치면 VITE_API_BASE_URL 이 틀렸을 때 화면이 통째로
 * 빕니다(2026-09-22 감사 P0-1 이 정확히 그 사고였습니다).
 *
 * 074 미적용 환경에서도 화면이 죽지 않게, 표가 없으면 빈 값으로 떨어집니다
 * (routineHistory.ts 와 같은 규칙).
 */
import { supabase } from '../lib/supabase'

/** 불편했던 곳. 'none' 은 "없음" 이고 다른 값과 함께 저장되지 않습니다(DB 트리거가 정리). */
export const BODY_PARTS = ['none', 'neck', 'shoulder', 'back', 'waist', 'pelvis', 'knee', 'ankle', 'other'] as const
export const BODY_SIDES = ['left', 'right', 'both', 'similar', 'unsure'] as const
export const BODY_ACTIVITIES = ['sitting_long', 'standing_long', 'walking', 'exercise', 'driving', 'screen', 'rest', 'other'] as const
export const BODY_CONDITIONS = ['comfortable', 'usual', 'slightly_uncomfortable', 'very_uncomfortable'] as const

export type BodyPart = (typeof BODY_PARTS)[number]
export type BodySide = (typeof BODY_SIDES)[number]
export type BodyActivity = (typeof BODY_ACTIVITIES)[number]
export type BodyCondition = (typeof BODY_CONDITIONS)[number]

/** 화면에 쓰는 말. 의료 표현을 쓰지 않습니다 — 진단이 아니라 본인이 느낀 것입니다. */
export const PART_LABEL: Record<BodyPart, string> = {
  none: '없음', neck: '목', shoulder: '어깨', back: '등', waist: '허리',
  pelvis: '골반', knee: '무릎', ankle: '발목', other: '기타',
}
export const SIDE_LABEL: Record<BodySide, string> = {
  left: '왼쪽', right: '오른쪽', both: '양쪽', similar: '비슷함', unsure: '모르겠음',
}
export const ACTIVITY_LABEL: Record<BodyActivity, string> = {
  sitting_long: '오래 앉기', standing_long: '오래 서기', walking: '걷기', exercise: '운동',
  driving: '운전', screen: '화면 보기', rest: '쉼', other: '기타',
}
export const CONDITION_LABEL: Record<BodyCondition, string> = {
  comfortable: '좋음', usual: '보통', slightly_uncomfortable: '조금 불편', very_uncomfortable: '많이 불편',
}

export interface BodyNote {
  id: string
  recordDate: string
  parts: BodyPart[]
  side: BodySide | null
  activities: BodyActivity[]
  condition: BodyCondition
  note: string | null
  updatedAt: string
}

export interface BodyNoteInput {
  recordDate: string
  parts: BodyPart[]
  side: BodySide | null
  activities: BodyActivity[]
  condition: BodyCondition
  note?: string | null
}

/**
 * 오늘 날짜(한국시간). 서버 UTC 날짜를 쓰면 밤 9시 이후 기록이 다음 날로 넘어갑니다.
 * 하루 경계(오전 6시)와는 다릅니다 — 바디 노트는 **달력 날짜**로 하루 한 건입니다.
 * "어제 밤에 적은 것" 이 오늘로 보이면 그게 더 혼란스럽습니다.
 */
export function kstToday(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60_000)
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`
}

function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const code = String(error.code ?? '')
  if (code === '42P01' || code === 'PGRST205') return true
  return /relation .* does not exist|could not find the table/i.test(String(error.message ?? ''))
}

interface Row {
  id: string
  record_date: string
  discomfort_parts: string[] | null
  side: string | null
  activity_tags: string[] | null
  condition: string
  note: string | null
  updated_at: string
}

const toNote = (r: Row): BodyNote => ({
  id: r.id,
  recordDate: r.record_date,
  parts: (r.discomfort_parts ?? []) as BodyPart[],
  side: (r.side as BodySide | null) ?? null,
  activities: (r.activity_tags ?? []) as BodyActivity[],
  condition: r.condition as BodyCondition,
  note: r.note,
  updatedAt: r.updated_at,
})

/** 오늘 적은 것이 있으면 돌려줍니다. 없으면 null. */
export async function fetchTodayBodyNote(): Promise<BodyNote | null> {
  const { data, error } = await supabase
    .from('body_notes')
    .select('id, record_date, discomfort_parts, side, activity_tags, condition, note, updated_at')
    .eq('record_date', kstToday())
    .maybeSingle()
  if (error) {
    if (missingTable(error)) return null
    throw error
  }
  return data ? toNote(data as Row) : null
}

/** 최근 기록. 기본 30건. */
export async function fetchBodyNoteHistory(limit = 30): Promise<BodyNote[]> {
  const { data, error } = await supabase
    .from('body_notes')
    .select('id, record_date, discomfort_parts, side, activity_tags, condition, note, updated_at')
    .order('record_date', { ascending: false })
    .limit(limit)
  if (error) {
    if (missingTable(error)) return []
    throw error
  }
  return ((data ?? []) as Row[]).map(toNote)
}

/**
 * 저장. 같은 날 다시 저장하면 **덮어씁니다**(하루 한 건).
 *
 * user_id 를 보내지 않습니다 — RLS 의 WITH CHECK 가 본인인지 보고, 기본값이 없으므로
 * 함수로 받아 채웁니다. 그래서 upsert 대신 "있으면 UPDATE, 없으면 INSERT" 를 직접 합니다.
 * (onConflict upsert 는 user_id 를 알아야 해서 클라이언트가 자기 프로필 id 를 알아야 합니다.)
 */
export async function saveBodyNote(input: BodyNoteInput): Promise<BodyNote | null> {
  const payload = {
    record_date: input.recordDate,
    discomfort_parts: input.parts,
    side: input.side,
    activity_tags: input.activities,
    condition: input.condition,
    note: input.note?.trim() ? input.note.trim() : null,
  }

  const existing = await fetchTodayBodyNote()
  if (existing && existing.recordDate === input.recordDate) {
    const { data, error } = await supabase
      .from('body_notes')
      .update(payload)
      .eq('id', existing.id)
      .select('id, record_date, discomfort_parts, side, activity_tags, condition, note, updated_at')
      .maybeSingle()
    if (error) { if (missingTable(error)) return null; throw error }
    return data ? toNote(data as Row) : null
  }

  const { data: profile } = await supabase.rpc('current_profile_id')
  const { data, error } = await supabase
    .from('body_notes')
    .insert({ ...payload, user_id: profile })
    .select('id, record_date, discomfort_parts, side, activity_tags, condition, note, updated_at')
    .maybeSingle()
  if (error) { if (missingTable(error)) return null; throw error }
  return data ? toNote(data as Row) : null
}

/** 한 줄 요약 — "어깨 · 오른쪽 · 오래 앉기 · 보통" */
export function summarize(note: BodyNote): string {
  const parts = note.parts.length ? note.parts.map((p) => PART_LABEL[p]).join('·') : '없음'
  const bits = [parts]
  if (note.side) bits.push(SIDE_LABEL[note.side])
  if (note.activities.length) bits.push(note.activities.map((a) => ACTIVITY_LABEL[a]).join('·'))
  bits.push(CONDITION_LABEL[note.condition])
  return bits.join(' · ')
}

/* ─────────────────────────────────────────────────────────────────────────
 * 전문가 안내
 *
 * 전문가가 내 몸 기록을 보고 남긴 한마디입니다. **내 기록을 고친 것이 아니라**
 * 따로 쌓인 글입니다(074). 읽기는 RLS 로 바로 하고, 읽음 처리만 함수로 합니다 —
 * UPDATE 권한을 주면 사용자가 message 까지 고칠 수 있기 때문입니다.
 *
 * 전문가가 철회하면 withdrawn_at 이 찍히고 RLS 가 그 줄을 빼므로, 여기서 따로
 * 거르지 않아도 사라집니다.
 * ───────────────────────────────────────────────────────────────────────── */

export type GuidanceType = 'comment' | 'check_next_session' | 'lifestyle_suggestion' | 'linked_mission'

/** 안내의 성격. 전문가가 고른 값을 사용자 말로 옮깁니다. */
export const GUIDANCE_LABEL: Record<GuidanceType, string> = {
  comment: '한마디',
  check_next_session: '다음에 같이 볼 것',
  lifestyle_suggestion: '생활 제안',
  linked_mission: '추천 동작',
}

export interface Guidance {
  id: string
  type: GuidanceType
  message: string
  createdAt: string
  readAt: string | null
}

/** 나에게 온 안내. 철회된 것은 RLS 가 이미 빼고 줍니다. */
export async function fetchMyGuidance(limit = 5): Promise<Guidance[]> {
  const { data, error } = await supabase
    .from('professional_body_note_guidance')
    .select('id, guidance_type, message, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    if (missingTable(error)) return []
    throw error
  }
  return ((data ?? []) as Array<{
    id: string; guidance_type: string; message: string; created_at: string; read_at: string | null
  }>).map((r) => ({
    id: r.id,
    type: r.guidance_type as GuidanceType,
    message: r.message,
    createdAt: r.created_at,
    readAt: r.read_at,
  }))
}

/** 읽음 처리. 실패해도 화면을 막지 않습니다 — 안내를 본 것이 더 중요합니다. */
export async function markGuidanceRead(id: string): Promise<void> {
  try {
    await supabase.rpc('mark_guidance_read', { p_guidance_id: id })
  } catch {
    /* 다음에 열 때 다시 시도됩니다 */
  }
}
