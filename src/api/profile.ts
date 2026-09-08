/**
 * 내 프로필 — 닉네임 · 키 · 몸무게.
 *
 * `height_cm` / `weight_kg` 는 037 에서 컬럼만 만들어 두고 앱에서 아무 데도 쓰지 않았습니다.
 * 여기가 그 값을 처음 쓰는 곳입니다.
 *
 * user_profiles 는 본인 행에 대해 SELECT/UPDATE 권한이 이미 있습니다(RLS 로 본인만).
 * 그래서 프로필 편집은 서버를 거치지 않습니다 — 결제와 달리 남에게 영향을 주지 않습니다.
 */
import { supabase } from '../lib/supabase'

export interface MyProfile {
  id: string
  email: string | null
  displayName: string | null
  nickname: string | null
  heightCm: number | null
  weightKg: number | null
}

export interface ProfileInput {
  nickname?: string | null
  heightCm?: number | null
  weightKg?: number | null
}

const COLUMNS = 'id, email, display_name, nickname, height_cm, weight_kg'

function warn(label: string, error: unknown) {
  const code = String((error as { code?: string } | null)?.code ?? '')
  if (code === '42703' || code === 'PGRST204') {
    console.warn(`[profile] ${label}: 컬럼이 아직 없습니다. db/journey/037_redesign.sql 적용이 필요합니다.`)
    return
  }
  console.warn(`[profile] ${label} failed:`, error)
}

function toProfile(row: Record<string, unknown>): MyProfile {
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))
  return {
    id: String(row.id),
    email: row.email ? String(row.email) : null,
    displayName: row.display_name ? String(row.display_name) : null,
    nickname: row.nickname ? String(row.nickname) : null,
    heightCm: num(row.height_cm),
    weightKg: num(row.weight_kg),
  }
}

/** auth 사용자 id 로 내 프로필 행을 찾습니다. id 와 auth_user_id 둘 다 볼 수 있습니다. */
export async function fetchMyProfile(userId: string): Promise<MyProfile | null> {
  if (!userId) return null

  const { data, error } = await supabase
    .from('user_profiles')
    .select(COLUMNS)
    .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
    .limit(1)
    .maybeSingle()

  if (error) {
    warn('fetchMyProfile', error)
    return null
  }
  return data ? toProfile(data as Record<string, unknown>) : null
}

/** 키·몸무게는 사람이 낼 수 있는 범위 밖이면 저장하지 않습니다(오타 방지). */
export function validateBody(heightCm: number | null, weightKg: number | null): string | null {
  if (heightCm !== null && (heightCm < 90 || heightCm > 250)) return '키는 90~250cm 사이로 입력해주세요.'
  if (weightKg !== null && (weightKg < 20 || weightKg > 300)) return '몸무게는 20~300kg 사이로 입력해주세요.'
  return null
}

export async function updateMyProfile(profileId: string, input: ProfileInput): Promise<MyProfile | null> {
  const patch: Record<string, unknown> = {}
  if (input.nickname !== undefined) patch.nickname = input.nickname
  if (input.heightCm !== undefined) patch.height_cm = input.heightCm
  if (input.weightKg !== undefined) patch.weight_kg = input.weightKg
  if (Object.keys(patch).length === 0) return null

  const { data, error } = await supabase
    .from('user_profiles')
    .update(patch)
    .eq('id', profileId)
    .select(COLUMNS)
    .maybeSingle()

  if (error) {
    warn('updateMyProfile', error)
    return null
  }
  return data ? toProfile(data as Record<string, unknown>) : null
}

// ---------------------------------------------------------------------------
// 측정 기록
// ---------------------------------------------------------------------------

export interface MeasurementRecord {
  id: string
  code: string
  measuredAt: string
  scoringMeta: Record<string, unknown> | null
  primaryIdentity: string | null
}

/** 완료된 진단 결과를 최신순으로. 변화 비교(compareJourneyResults)에 그대로 넣을 수 있습니다. */
export async function fetchMeasurementHistory(userId: string, limit = 10): Promise<MeasurementRecord[]> {
  if (!userId) return []

  const { data, error } = await supabase
    .from('questionnaire_responses')
    .select('id, calculated_code, primary_identity, scoring_meta, completed_at, updated_at, created_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('calculated_code', 'is', null)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    warn('fetchMeasurementHistory', error)
    return []
  }

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: String(r.id),
      code: String(r.calculated_code ?? ''),
      measuredAt: String(r.completed_at ?? r.updated_at ?? r.created_at ?? ''),
      scoringMeta: (r.scoring_meta as Record<string, unknown> | null) ?? null,
      primaryIdentity: r.primary_identity ? String(r.primary_identity) : null,
    }
  })
}
