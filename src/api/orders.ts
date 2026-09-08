/**
 * MEBODY — 주문 · 적립금 차감
 *
 * 금액 계산과 적립금 차감은 전부 서버(create_order RPC)가 합니다.
 * 여기서 총액을 계산하거나 차감액을 정하면 안 됩니다. 화면 표시용 계산만 합니다.
 *
 * 결제 승인은 아직 없습니다(결제사 미정). 주문은 PENDING 으로 생성되고,
 * 취소하면 사용한 적립금이 원장에 환불 엔트리로 복구됩니다.
 */

import { supabase } from '../lib/supabase'

export interface OrderItemInput {
  productId: string
  quantity?: number
}

export interface OrderResult {
  orderId: string
  subtotal: number
  rewardUsed: number
  total: number
  balance: number
}

export type FulfillmentStatus = 'NONE' | 'PREPARING' | 'SHIPPED' | 'DELIVERED'

export interface MyOrder {
  id: string
  status: 'PENDING' | 'PAID' | 'CANCELED' | 'FAILED'
  /** 배송 단계. 결제 상태와 별개 축입니다(042). */
  fulfillmentStatus: FulfillmentStatus
  trackingCarrier: string | null
  trackingNo: string | null
  subtotalKrw: number
  rewardUsed: number
  totalKrw: number
  createdAt: string
  /** 주문한 상품 요약. 없으면 빈 배열 */
  items: Array<{ name: string; quantity: number; unitPrice: number }>
  /** 지금 취소할 수 있는가 — 결제 전이거나, 결제 후 발송 전 */
  cancelable: boolean
}

function isSchemaMissing(error: unknown): boolean {
  const code = String((error as { code?: string } | null)?.code ?? '')
  const text = String((error as { message?: string } | null)?.message ?? '').toLowerCase()
  return code === 'PGRST202' || code === 'PGRST205' || text.includes('does not exist') || text.includes('schema cache')
}

function warn(label: string, error: unknown) {
  if (isSchemaMissing(error)) {
    console.warn(`[orders] ${label}: 스키마가 아직 없습니다. db/journey/032_orders.sql 적용이 필요합니다.`)
    return
  }
  console.warn(`[orders] ${label} failed:`, error)
}

/** 화면 표시용 적용가. 실제 차감액은 서버가 다시 계산합니다. */
export function previewRewardUse(priceKrw: number | null, balance: number): number {
  if (priceKrw === null || !Number.isFinite(priceKrw)) return 0
  return Math.max(0, Math.min(balance, Math.floor(priceKrw)))
}

export async function createOrder(
  items: OrderItemInput[],
  rewardToUse = 0,
  addressId?: string | null,
): Promise<OrderResult | null> {
  if (items.length === 0) return null

  const payload = items.map((item) => ({
    product_id: item.productId,
    quantity: Math.max(1, item.quantity ?? 1),
  }))

  const { data, error } = await supabase.rpc('create_order', {
    p_items: payload,
    p_reward_to_use: Math.max(0, Math.floor(rewardToUse)),
    // 040 미적용 환경에서는 인자가 2개인 옛 함수라 이 값을 빼고 보냅니다.
    ...(addressId ? { p_address_id: addressId } : {}),
  })

  if (error) {
    warn('createOrder', error)
    return null
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined
  if (!row) return null

  return {
    orderId: String(row.order_id),
    subtotal: Number(row.subtotal ?? 0),
    rewardUsed: Number(row.reward_used ?? 0),
    total: Number(row.total ?? 0),
    balance: Number(row.balance ?? 0),
  }
}

export async function cancelOrder(orderId: string): Promise<{ refunded: number; balance: number } | null> {
  if (!orderId) return null

  const { data, error } = await supabase.rpc('cancel_order', { p_order_id: orderId })
  if (error) {
    warn('cancelOrder', error)
    return null
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined
  if (!row) return null
  return { refunded: Number(row.refunded ?? 0), balance: Number(row.balance ?? 0) }
}

/**
 * 결제 완료 주문의 구매 적립(멤버십 5%)을 청구합니다.
 * 주문이 PAID 가 아니면 서버 함수가 42501 로 거절합니다 — 결제 전에는 받을 수 없습니다.
 */
export async function claimPurchaseReward(orderId: string): Promise<{ amount: number; percent: number; alreadyClaimed: boolean } | null> {
  if (!orderId) return null

  const { data, error } = await supabase.rpc('claim_purchase_reward', { p_order_id: orderId })
  if (error) {
    warn('claimPurchaseReward', error)
    return null
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined
  if (!row) return null
  return {
    amount: Number(row.amount ?? 0),
    percent: Number(row.percent ?? 0),
    alreadyClaimed: Boolean(row.already_claimed),
  }
}

/** 042 미적용 환경을 한 번만 확인하고 기억합니다. */
let fulfillmentColumnsMissing = false

export async function fetchMyOrders(userId: string): Promise<MyOrder[]> {
  if (!userId) return []

  // 042 미적용 환경에서는 배송 컬럼이 없으므로 기본 컬럼으로 물러섭니다.
  // 한 번 물러선 뒤에는 그 사실을 기억합니다 — 매번 실패 요청을 보내면
  // 콘솔에 400 이 계속 찍히고 왕복도 두 배가 됩니다.
  const full = 'id, status, subtotal_krw, reward_used, total_krw, created_at,'
    + ' fulfillment_status, tracking_carrier, tracking_no,'
    + ' order_items(name, quantity, unit_price)'
  const basic = 'id, status, subtotal_krw, reward_used, total_krw, created_at'

  const attempts = fulfillmentColumnsMissing ? [basic] : [full, basic]
  let rows: unknown[] | null = null
  for (const columns of attempts) {
    const { data, error } = await supabase
      .from('orders')
      .select(columns)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!error) {
      rows = data ?? []
      break
    }
    if (columns === full) {
      fulfillmentColumnsMissing = true
      console.warn('[orders] 배송 컬럼이 없습니다. db/journey/042_fulfillment_and_ssv.sql 적용이 필요합니다.')
      continue
    }
    warn('fetchMyOrders', error)
    return []
  }

  return (rows ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const status = (r.status as MyOrder['status']) ?? 'PENDING'
    const fulfillment = (String(r.fulfillment_status ?? 'NONE') as FulfillmentStatus)
    const items = Array.isArray(r.order_items)
      ? (r.order_items as Array<Record<string, unknown>>).map((item) => ({
          name: String(item.name ?? ''),
          quantity: Number(item.quantity ?? 1),
          unitPrice: Number(item.unit_price ?? 0),
        }))
      : []
    return {
      id: String(r.id),
      status,
      fulfillmentStatus: fulfillment,
      trackingCarrier: r.tracking_carrier ? String(r.tracking_carrier) : null,
      trackingNo: r.tracking_no ? String(r.tracking_no) : null,
      subtotalKrw: Number(r.subtotal_krw ?? 0),
      rewardUsed: Number(r.reward_used ?? 0),
      totalKrw: Number(r.total_krw ?? 0),
      createdAt: String(r.created_at),
      items,
      // 결제 전이면 언제든, 결제 후에는 발송 전까지만 취소할 수 있습니다.
      cancelable: status === 'PENDING' || (status === 'PAID' && (fulfillment === 'NONE' || fulfillment === 'PREPARING')),
    }
  })
}
