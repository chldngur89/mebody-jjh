/**
 * 배송지 — 실물 상품 배송에 필요합니다.
 *
 * RLS 로 본인 것만 읽고 씁니다(040). 040 미적용 환경에서는 빈 목록으로 폴백해
 * 진단·결과 같은 나머지 화면이 깨지지 않게 합니다.
 */
import { supabase } from '../lib/supabase'

export interface UserAddress {
  id: string
  label: string | null
  recipient: string
  phone: string
  postcode: string
  address1: string
  address2: string | null
  memo: string | null
  isDefault: boolean
}

export interface AddressInput {
  label?: string | null
  recipient: string
  phone: string
  postcode: string
  address1: string
  address2?: string | null
  memo?: string | null
  isDefault?: boolean
}

function isSchemaMissing(error: unknown): boolean {
  const code = String((error as { code?: string } | null)?.code ?? '')
  const text = String((error as { message?: string } | null)?.message ?? '').toLowerCase()
  return code === 'PGRST205' || code === '42P01' || text.includes('does not exist') || text.includes('schema cache')
}

function warn(label: string, error: unknown) {
  if (isSchemaMissing(error)) {
    console.warn(`[addresses] ${label}: 스키마가 아직 없습니다. db/journey/040_billing.sql 적용이 필요합니다.`)
    return
  }
  console.warn(`[addresses] ${label} failed:`, error)
}

const COLUMNS = 'id, label, recipient, phone, postcode, address1, address2, memo, is_default'

function toAddress(row: Record<string, unknown>): UserAddress {
  return {
    id: String(row.id),
    label: row.label === null || row.label === undefined ? null : String(row.label),
    recipient: String(row.recipient ?? ''),
    phone: String(row.phone ?? ''),
    postcode: String(row.postcode ?? ''),
    address1: String(row.address1 ?? ''),
    address2: row.address2 === null || row.address2 === undefined ? null : String(row.address2),
    memo: row.memo === null || row.memo === undefined ? null : String(row.memo),
    isDefault: Boolean(row.is_default),
  }
}

export async function fetchMyAddresses(): Promise<UserAddress[]> {
  const { data, error } = await supabase
    .from('user_addresses')
    .select(COLUMNS)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    warn('fetchMyAddresses', error)
    return []
  }
  return (data ?? []).map((row) => toAddress(row as Record<string, unknown>))
}

export async function createAddress(userId: string, input: AddressInput): Promise<UserAddress | null> {
  // 기본 배송지는 사용자당 하나뿐입니다(부분 유니크 인덱스). 새로 기본을 지정하면 기존 것을 내립니다.
  if (input.isDefault) {
    await clearDefault(userId)
  }

  const { data, error } = await supabase
    .from('user_addresses')
    .insert({
      user_id: userId,
      label: input.label ?? null,
      recipient: input.recipient,
      phone: input.phone,
      postcode: input.postcode,
      address1: input.address1,
      address2: input.address2 ?? null,
      memo: input.memo ?? null,
      is_default: Boolean(input.isDefault),
    })
    .select(COLUMNS)
    .maybeSingle()

  if (error) {
    warn('createAddress', error)
    return null
  }
  return data ? toAddress(data as Record<string, unknown>) : null
}

export async function updateAddress(id: string, userId: string, input: AddressInput): Promise<UserAddress | null> {
  if (input.isDefault) {
    await clearDefault(userId, id)
  }

  const { data, error } = await supabase
    .from('user_addresses')
    .update({
      label: input.label ?? null,
      recipient: input.recipient,
      phone: input.phone,
      postcode: input.postcode,
      address1: input.address1,
      address2: input.address2 ?? null,
      memo: input.memo ?? null,
      is_default: Boolean(input.isDefault),
    })
    .eq('id', id)
    .select(COLUMNS)
    .maybeSingle()

  if (error) {
    warn('updateAddress', error)
    return null
  }
  return data ? toAddress(data as Record<string, unknown>) : null
}

export async function deleteAddress(id: string): Promise<boolean> {
  const { error } = await supabase.from('user_addresses').delete().eq('id', id)
  if (error) {
    warn('deleteAddress', error)
    return false
  }
  return true
}

async function clearDefault(userId: string, exceptId?: string) {
  let query = supabase.from('user_addresses').update({ is_default: false }).eq('user_id', userId).eq('is_default', true)
  if (exceptId) query = query.neq('id', exceptId)
  const { error } = await query
  if (error) warn('clearDefault', error)
}

/** 주문 시점의 배송지 사본. user_addresses 가 바뀌어도 주문 내역은 그대로여야 합니다. */
export function toShippingSnapshot(address: UserAddress): Record<string, string> {
  return {
    recipient: address.recipient,
    phone: address.phone,
    postcode: address.postcode,
    address1: address.address1,
    address2: address.address2 ?? '',
    memo: address.memo ?? '',
  }
}
