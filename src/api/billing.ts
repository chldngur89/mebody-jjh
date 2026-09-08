/**
 * 결제 — 앱이 Spring 서버를 부르는 유일한 곳입니다.
 *
 * 왜 서버를 거치나:
 *   앱은 `user_subscriptions` 와 `orders.status` 에 **쓰기 권한이 없습니다**(SELECT 만).
 *   040 의 *_admin 함수도 authenticated 에서 EXECUTE 를 회수했습니다.
 *   앱이 직접 쓸 수 있으면 누구나 공짜로 멤버십을 켜고 주문을 결제 완료로 만들 수 있기 때문입니다.
 *   그래서 **결제 UI 는 앱, 상태 변경은 서버**입니다.
 *
 * 서버가 없어도 앱은 그대로 동작해야 합니다(.env.example 의 약속).
 * `VITE_API_BASE_URL` 이 비어 있으면 결제만 잠기고 진단·결과·미션은 영향받지 않습니다.
 */
import { supabase } from '../lib/supabase'

const API_BASE = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

export interface BillingConfig {
  /** 구독 결제 수단. null 이면 아직 붙지 않았습니다 */
  subscriptionProvider: string | null
  /** 실물 상품 결제 수단. null 이면 아직 붙지 않았습니다 */
  orderProvider: string | null
  /** 개발용 어댑터로 돌고 있는가 — 화면에 표시해서 실결제로 오해하지 않게 합니다 */
  devMode: boolean
  /** 결제 서버 주소 자체가 설정되지 않음 */
  serverMissing?: boolean
}

export interface SubscriptionState {
  planCode: string | null
  status: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export interface OrderPaymentResult {
  orderId: string
  status: string
  totalKrw: number
  provider: string
  /** false 면 이미 결제된 주문이었습니다(재시도) */
  changed: boolean
}

export const BILLING_UNAVAILABLE: BillingConfig = {
  subscriptionProvider: null,
  orderProvider: null,
  devMode: false,
  serverMissing: true,
}

export function isBillingServerConfigured(): boolean {
  return API_BASE.length > 0
}

/** 결제 요청이 실패한 이유. 화면이 사용자에게 그대로 보여줄 수 있는 문구를 담습니다. */
export class BillingError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'BillingError'
    this.status = status
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new BillingError('로그인이 필요합니다.', 401)
  return { Authorization: `Bearer ${token}` }
}

async function callServer<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  if (!API_BASE) {
    throw new BillingError('결제 서버가 아직 연결되지 않았습니다.', 503)
  }
  const headers = await authHeader()
  const response = await fetch(`${API_BASE}${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { ...headers, 'Content-Type': 'application/json' } : headers,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })

  let payload: { success?: boolean; data?: T; message?: string } | null = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new BillingError(
      payload?.message ?? (response.status === 501 ? '결제 수단이 아직 연결되지 않았습니다.' : '결제 처리에 실패했습니다.'),
      response.status,
    )
  }
  return payload?.data as T
}

/** 결제 버튼을 열지 말지 판단합니다. 실패해도 예외를 던지지 않고 "불가능"으로 답합니다. */
export async function fetchBillingConfig(): Promise<BillingConfig> {
  if (!API_BASE) return BILLING_UNAVAILABLE
  try {
    const config = await callServer<BillingConfig>('/api/billing/config')
    return { ...config, serverMissing: false }
  } catch (error) {
    if (!(error instanceof BillingError) || error.status !== 401) {
      console.warn('[billing] config 조회 실패:', error)
    }
    return BILLING_UNAVAILABLE
  }
}

/**
 * 스토어 영수증을 서버에 넘겨 멤버십을 활성화합니다.
 * **금액을 보내지 않습니다** — 서버가 membership_plans 에서 직접 읽습니다.
 */
export async function verifySubscription(planCode: string, purchaseToken: string): Promise<SubscriptionState> {
  return callServer<SubscriptionState>('/api/billing/subscription/verify', {
    method: 'POST',
    body: { planCode, purchaseToken },
  })
}

/** 기본은 이용 기간이 끝나면 해지입니다(이미 낸 기간은 그대로 씁니다). */
export async function cancelSubscription(immediate = false): Promise<SubscriptionState> {
  return callServer<SubscriptionState>(`/api/billing/subscription/cancel?immediate=${immediate ? 'true' : 'false'}`, {
    method: 'POST',
  })
}

/**
 * PG 결제 승인 → 주문을 결제 완료로.
 * **금액을 보내지 않습니다** — 서버가 orders.total_krw 에서 직접 읽습니다.
 */
export async function confirmOrderPayment(orderId: string, paymentKey: string): Promise<OrderPaymentResult> {
  return callServer<OrderPaymentResult>(`/api/billing/orders/${encodeURIComponent(orderId)}/confirm`, {
    method: 'POST',
    body: { paymentKey },
  })
}

export interface OrderCancelResult {
  orderId: string
  /** 주문에 썼다가 돌려받은 적립금 */
  refunded: number
  /** 취소로 회수된 구매 적립(5%) */
  clawedBack: number
  balance: number
  changed: boolean
}

/**
 * 주문 취소. 결제사 환불이 먼저이고, 성공해야 주문이 취소됩니다.
 * 발송된 뒤에는 서버가 거절합니다(그건 반품입니다).
 */
export async function cancelOrder(orderId: string, reason?: string): Promise<OrderCancelResult> {
  const query = reason ? `?reason=${encodeURIComponent(reason)}` : ''
  return callServer<OrderCancelResult>(`/api/billing/orders/${encodeURIComponent(orderId)}/cancel${query}`, {
    method: 'POST',
  })
}

/**
 * 보상형 광고 서버 검증이 켜져 있는가.
 * 켜져 있으면 앱이 보너스를 직접 청구하지 않고 서버 지급을 기다립니다.
 */
export async function fetchAdRewardConfig(): Promise<{ ssvEnabled: boolean }> {
  if (!API_BASE) return { ssvEnabled: false }
  try {
    return await callServer<{ ssvEnabled: boolean }>('/api/ads/config')
  } catch {
    return { ssvEnabled: false }
  }
}
