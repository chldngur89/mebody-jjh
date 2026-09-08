/**
 * 공통 스트레칭 완료 주사위 적립 (하루 1회)
 *
 * 주사위 눈과 적립액은 전부 서버(claim_daily_routine_reward)가 정합니다.
 * 화면은 서버가 돌려준 눈으로 애니메이션을 멈출 뿐, 값을 만들지 않습니다.
 * 하루의 경계는 한국시간 오전 5시이며 서버의 mebody_service_day() 가 판정합니다.
 *
 * 033_daily_routine_reward.sql 미적용 환경에서도 화면이 죽지 않도록,
 * 함수가 없으면(42883/PGRST202) unavailable 로 조용히 떨어집니다.
 */
import { supabase } from '../lib/supabase'

export interface RoutineRewardResult {
  /** 서버가 굴린 주사위 눈 1~6 */
  dice: number
  /** 실제 적립액 (주사위 x 구독 등급 배수) */
  amount: number
  /** 오늘 이미 받았으면 true — 이 경우 잔액은 늘지 않습니다 */
  alreadyClaimed: boolean
  balance: number
  multiplier: number
}

export interface TodayRoutineReward {
  claimed: boolean
  dice: number | null
  amount: number | null
}

export interface RoutineBonusStatus {
  /** 지금 보너스를 받을 수 있는가 */
  eligible: boolean
  claimed: boolean
  dice: number | null
  amount: number | null
  /** membership | claimed | routine_not_done | ready */
  reason: string
}

/** 적립 기능 자체가 아직 배포되지 않은 상태 */
export const REWARD_UNAVAILABLE = 'unavailable' as const

function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const code = String(error.code ?? '')
  if (code === '42883' || code === 'PGRST202') return true
  return /could not find the function|does not exist/i.test(String(error.message ?? ''))
}

/**
 * 오늘 이미 받았는지 조회합니다. 적립하지 않습니다.
 * 비로그인이거나 기능 미배포면 null 을 돌려줍니다.
 */
export async function fetchTodayRoutineReward(): Promise<TodayRoutineReward | null> {
  const { data, error } = await supabase.rpc('today_routine_reward')
  if (error) {
    if (!isMissingFunction(error)) console.warn('today_routine_reward failed:', error)
    return null
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    claimed: Boolean(row.claimed),
    dice: row.dice == null ? null : Number(row.dice),
    amount: row.amount == null ? null : Number(row.amount),
  }
}

/**
 * 주사위를 굴려 적립합니다. 하루 1회이며, 두 번째부터는 alreadyClaimed=true 로
 * 그날 나온 눈을 그대로 돌려줍니다(화면이 같은 숫자를 보여주도록).
 */
export async function claimRoutineReward(): Promise<RoutineRewardResult | typeof REWARD_UNAVAILABLE | null> {
  const { data, error } = await supabase.rpc('claim_daily_routine_reward')
  if (error) {
    if (isMissingFunction(error)) return REWARD_UNAVAILABLE
    console.warn('claim_daily_routine_reward failed:', error)
    return null
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    dice: Number(row.dice),
    amount: Number(row.amount),
    alreadyClaimed: Boolean(row.already_claimed),
    balance: Number(row.balance),
    multiplier: Number(row.multiplier ?? 1),
  }
}


/**
 * 오늘 보너스를 받을 수 있는 상태인지 조회합니다. 적립하지 않습니다.
 * 유료 회원은 eligible=false, reason='membership' 입니다.
 */
export async function fetchTodayRoutineBonus(): Promise<RoutineBonusStatus | null> {
  const { data, error } = await supabase.rpc('today_routine_bonus')
  if (error) {
    if (!isMissingFunction(error)) console.warn('today_routine_bonus failed:', error)
    return null
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    eligible: Boolean(row.eligible),
    claimed: Boolean(row.claimed),
    dice: row.dice == null ? null : Number(row.dice),
    amount: row.amount == null ? null : Number(row.amount),
    reason: String(row.reason ?? ''),
  }
}

/**
 * 보상형 광고를 끝까지 본 뒤 보너스 주사위를 굴립니다.
 *
 * 눈과 금액은 서버가 정합니다. 하루 1회이고, 기본 적립을 먼저 받아야 하며,
 * 유료 회원은 서버에서 거부됩니다(화면에서 숨기는 것만으로는 부족하므로).
 */
export async function claimRoutineBonus(): Promise<RoutineRewardResult | typeof REWARD_UNAVAILABLE | null> {
  const { data, error } = await supabase.rpc('claim_routine_bonus_reward')
  if (error) {
    if (isMissingFunction(error)) return REWARD_UNAVAILABLE
    console.warn('claim_routine_bonus_reward failed:', error)
    return null
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    dice: Number(row.dice),
    amount: Number(row.amount),
    alreadyClaimed: Boolean(row.already_claimed),
    balance: Number(row.balance),
    multiplier: 1,
  }
}
