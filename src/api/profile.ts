/**
 * 내 프로필 — 이름 · 이메일 · 휴대폰 · 키 · 몸무게.
 *
 * user_profiles 는 본인 행에 대해 SELECT/UPDATE 권한이 이미 있습니다(RLS 로 본인만).
 * 이메일·비밀번호 변경은 Supabase Auth 를 거칩니다.
 * 휴대폰은 연락처로만 저장합니다. 로그인 식별자(휴대폰 별칭 이메일)는 바꾸지 않을 수 있습니다.
 */
import { supabase } from '../lib/supabase'
import { isEmail, phoneFromLoginEmail } from '../lib/identifier'

export interface MyProfile {
  id: string
  email: string | null
  displayName: string | null
  nickname: string | null
  phone: string | null
  heightCm: number | null
  weightKg: number | null
}

export interface ProfileInput {
  nickname?: string | null
  phone?: string | null
  heightCm?: number | null
  weightKg?: number | null
}

const COLUMNS = 'id, email, display_name, nickname, phone, height_cm, weight_kg'

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
    phone: row.phone ? String(row.phone) : null,
    heightCm: num(row.height_cm),
    weightKg: num(row.weight_kg),
  }
}

/** 이름·휴대폰·키·몸무게가 모두 있으면 완료로 봅니다. */
export function isProfileComplete(profile: {
  nickname?: string | null
  displayName?: string | null
  phone?: string | null
  heightCm?: number | null
  weightKg?: number | null
  email?: string | null
}): boolean {
  const name = (profile.nickname ?? profile.displayName ?? '').trim()
  const phone = (profile.phone ?? phoneFromLoginEmail(profile.email) ?? '').trim()
  return Boolean(name && phone && profile.heightCm != null && profile.weightKg != null)
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

export async function updateMyProfile(
  profileId: string,
  input: ProfileInput,
  options?: { userId?: string; email?: string | null },
): Promise<MyProfile | null> {
  const patch: Record<string, unknown> = {}
  if (input.nickname !== undefined) {
    patch.nickname = input.nickname
    patch.display_name = input.nickname
    patch.name = input.nickname
  }
  if (input.phone !== undefined) patch.phone = input.phone
  if (input.heightCm !== undefined) patch.height_cm = input.heightCm
  if (input.weightKg !== undefined) patch.weight_kg = input.weightKg
  if (options?.email !== undefined) patch.email = options.email

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

  if (input.nickname !== undefined) {
    const { error: authError } = await supabase.auth.updateUser({
      data: { display_name: input.nickname ?? '' },
    })
    if (authError) console.warn('[profile] auth display_name sync failed:', authError)
  }

  return data ? toProfile(data as Record<string, unknown>) : null
}

/** 프로필 행이 없으면 만들어 저장합니다. */
export async function saveMyProfile(
  userId: string,
  profileId: string | null,
  input: ProfileInput,
  options?: { email?: string | null },
): Promise<MyProfile | null> {
  if (profileId) return updateMyProfile(profileId, input, { userId, email: options?.email })

  const payload: Record<string, unknown> = {
    id: userId,
    auth_user_id: userId,
    email: options?.email ?? null,
  }
  if (input.nickname !== undefined) {
    payload.nickname = input.nickname
    payload.display_name = input.nickname
    payload.name = input.nickname
  }
  if (input.phone !== undefined) payload.phone = input.phone
  if (input.heightCm !== undefined) payload.height_cm = input.heightCm
  if (input.weightKg !== undefined) payload.weight_kg = input.weightKg

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(payload, { onConflict: 'id' })
    .select(COLUMNS)
    .maybeSingle()

  if (error) {
    warn('saveMyProfile', error)
    return null
  }

  if (input.nickname !== undefined) {
    const { error: authError } = await supabase.auth.updateUser({
      data: { display_name: input.nickname ?? '' },
    })
    if (authError) console.warn('[profile] auth display_name sync failed:', authError)
  }

  return data ? toProfile(data as Record<string, unknown>) : null
}

/** 로그인 이메일 변경. 확인 메일이 필요할 수 있습니다. */
export async function updateMyEmail(nextEmail: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const email = nextEmail.trim().toLowerCase()
  if (!isEmail(email)) return { ok: false, message: '이메일 형식이 올바르지 않습니다.' }

  const { error } = await supabase.auth.updateUser({ email })
  if (error) return { ok: false, message: error.message || '이메일을 바꾸지 못했습니다.' }
  return { ok: true }
}

/** 비밀번호 변경. 빈 값이면 건너뜁니다. */
export async function updateMyPassword(nextPassword: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const password = nextPassword.trim()
  if (!password) return { ok: true }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { ok: false, message: error.message || '비밀번호를 바꾸지 못했습니다.' }
  return { ok: true }
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
