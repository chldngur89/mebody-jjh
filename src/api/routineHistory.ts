/**
 * 미션 탭 · 내 상태 탭이 쓰는 조회들.
 *
 * 037_redesign.sql 의 RPC 를 감쌉니다. 미적용 환경에서도 화면이 죽지 않도록
 * 함수가 없으면 빈 값으로 떨어집니다(routineReward.ts 와 같은 규칙).
 */
import { supabase } from '../lib/supabase'

export interface RoutineDay {
  serviceDay: string
  baseAmount: number
  bonusAmount: number
}

export interface ChallengeStatus {
  weekStart: string
  weekDone: number
  weekRequired: number
  weekClaimed: boolean
  monthStart: string
  monthDone: number
  monthRequired: number
  monthClaimed: boolean
}

export interface RewardEntry {
  id: string
  entryType: string
  label: string
  amount: number
  createdAt: string
}

export interface ChallengeClaim {
  amount: number
  alreadyClaimed: boolean
  doneDays: number
  required: number
  balance: number
}

function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const code = String(error.code ?? '')
  if (code === '42883' || code === 'PGRST202') return true
  return /could not find the function|does not exist/i.test(String(error.message ?? ''))
}

/** 기간 내 공통 스트레칭 수행 이력. 수행한 날만 돌아옵니다. */
export async function fetchRoutineHistory(from: string, to: string): Promise<RoutineDay[]> {
  const { data, error } = await supabase.rpc('routine_history', { p_from: from, p_to: to })
  if (error) {
    if (!isMissingFunction(error)) console.warn('routine_history failed:', error)
    return []
  }
  return (Array.isArray(data) ? data : []).map((row) => ({
    serviceDay: String(row.service_day),
    baseAmount: Number(row.base_amount ?? 0),
    bonusAmount: Number(row.bonus_amount ?? 0),
  }))
}

export async function fetchChallengeStatus(): Promise<ChallengeStatus | null> {
  const { data, error } = await supabase.rpc('routine_challenge_status')
  if (error) {
    if (!isMissingFunction(error)) console.warn('routine_challenge_status failed:', error)
    return null
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    weekStart: String(row.week_start),
    weekDone: Number(row.week_done ?? 0),
    weekRequired: Number(row.week_required ?? 7),
    weekClaimed: Boolean(row.week_claimed),
    monthStart: String(row.month_start),
    monthDone: Number(row.month_done ?? 0),
    monthRequired: Number(row.month_required ?? 20),
    monthClaimed: Boolean(row.month_claimed),
  }
}

async function claim(fn: 'claim_weekly_challenge' | 'claim_monthly_challenge'): Promise<ChallengeClaim | null> {
  const { data, error } = await supabase.rpc(fn)
  if (error) {
    if (!isMissingFunction(error)) console.warn(`${fn} failed:`, error)
    return null
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    amount: Number(row.amount ?? 0),
    alreadyClaimed: Boolean(row.already_claimed),
    doneDays: Number(row.done_days ?? 0),
    required: Number(row.required ?? 0),
    balance: Number(row.balance ?? 0),
  }
}

export const claimWeeklyChallenge = () => claim('claim_weekly_challenge')
export const claimMonthlyChallenge = () => claim('claim_monthly_challenge')

/** 적립 내역 — 내 상태 탭 */
export async function fetchRewardHistory(limit = 30): Promise<RewardEntry[]> {
  const { data, error } = await supabase.rpc('reward_history', { p_limit: limit })
  if (error) {
    if (!isMissingFunction(error)) console.warn('reward_history failed:', error)
    return []
  }
  return (Array.isArray(data) ? data : []).map((row) => ({
    id: String(row.id),
    entryType: String(row.entry_type),
    label: String(row.label),
    amount: Number(row.amount ?? 0),
    createdAt: String(row.created_at),
  }))
}
