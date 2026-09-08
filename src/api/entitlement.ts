/**
 * 무료/유료 자격 판정
 *
 * 실제 잠금은 DB(RLS)가 합니다. 여기서 얻는 값은 **화면 안내용**입니다.
 * 화면이 허용해도 자격이 없으면 user_journeys INSERT 가 42501 로 거부됩니다.
 *
 * 034_entitlement.sql 미적용 환경에서는 전부 무료·허용으로 폴백해
 * 지금 동작하는 화면이 깨지지 않게 합니다.
 */
import { supabase } from '../lib/supabase'

export type SubscriptionTier = 'free' | 'basic' | 'pro'

export interface Entitlement {
  tier: SubscriptionTier
  /** 활성 구독 보유 — 광고 제거 판단 기준 */
  isPaid: boolean
  /** 저니를 새로 시작할 수 있는가 (첫 저니는 무료) */
  canStartJourney: boolean
  /** 지금까지 시작한 저니 수. 1 이상이면 무료 체험을 이미 썼다 */
  journeyCount: number
  /** 034 미적용이라 판정 없이 폴백한 상태 */
  isFallback: boolean
}

/** 034 미적용/비로그인 시의 안전한 기본값 — 아무것도 막지 않습니다 */
export const FREE_OPEN_ENTITLEMENT: Entitlement = {
  tier: 'free',
  isPaid: false,
  canStartJourney: true,
  journeyCount: 0,
  isFallback: true,
}

function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const code = String(error.code ?? '')
  if (code === '42883' || code === 'PGRST202') return true
  return /could not find the function|does not exist/i.test(String(error.message ?? ''))
}

export async function fetchEntitlement(userId: string | null | undefined): Promise<Entitlement> {
  if (!userId) return FREE_OPEN_ENTITLEMENT

  const { data, error } = await supabase.rpc('journey_entitlement')
  if (error) {
    if (!isMissingFunction(error)) console.warn('journey_entitlement failed:', error)
    return FREE_OPEN_ENTITLEMENT
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) return FREE_OPEN_ENTITLEMENT

  const tier = (['free', 'basic', 'pro'] as const).includes(row.tier) ? (row.tier as SubscriptionTier) : 'free'
  return {
    tier,
    isPaid: Boolean(row.is_paid),
    canStartJourney: Boolean(row.can_start),
    journeyCount: Number(row.journey_count ?? 0),
    isFallback: false,
  }
}

/** 저니를 시작하지 못하는 이유가 "구독 필요" 인지 */
export function needsSubscription(entitlement: Entitlement): boolean {
  return !entitlement.isFallback && !entitlement.canStartJourney && !entitlement.isPaid
}
