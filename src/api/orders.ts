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

export interface MyOrder {
  id: string
  status: 'PENDING' | 'PAID' | 'CANCELED' | 'FAILED'
  subtotalKrw: number
  rewardUsed: number
  totalKrw: number
  createdAt: string
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

export async function createOrder(items: OrderItemInput[], rewardToUse = 0): Promise<OrderResult | null> {
  if (items.length === 0) return null

  const payload = items.map((item) => ({
    product_id: item.productId,
    quantity: Math.max(1, item.quantity ?? 1),
  }))

  const { data, error } = await supabase.rpc('create_order', {
    p_items: payload,
    p_reward_to_use: Math.max(0, Math.floor(rewardToUse)),
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

export async function fetchMyOrders(userId: string): Promise<MyOrder[]> {
  if (!userId) return []

  const { data, error } = await supabase
    .from('orders')
    .select('id, status, subtotal_krw, reward_used, total_krw, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    warn('fetchMyOrders', error)
    return []
  }

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: String(r.id),
      status: (r.status as MyOrder['status']) ?? 'PENDING',
      subtotalKrw: Number(r.subtotal_krw ?? 0),
      rewardUsed: Number(r.reward_used ?? 0),
      totalKrw: Number(r.total_krw ?? 0),
      createdAt: String(r.created_at),
    }
  })
}
