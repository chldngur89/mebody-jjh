/**
 * 계정 탈퇴 — 서버를 거칩니다.
 *
 * 인증 계정(auth.users) 삭제에는 서비스 롤 키가 필요한데 그 키는 앱에 둘 수 없습니다.
 * 그래서 서버가 두 걸음으로 처리합니다. 앱 데이터를 정리하고, 그다음 인증 계정을 지웁니다.
 *
 * 주문·결제 기록은 전자상거래법상 보존 대상이라 남습니다. 대신 구매자 연결이 끊겨
 * 누구의 것인지 알 수 없게 됩니다. 몇 건이 남는지는 응답에 담겨 옵니다.
 */
import { supabase } from '../lib/supabase'

const API_BASE = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

export class AccountDeletionError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AccountDeletionError'
    this.status = status
  }
}

export interface AccountDeletionResult {
  /** 법정 보존 대상이라 남는 주문 수 */
  keptOrders: number
  /** 남는 결제 수 */
  keptPayments: number
  note: string
}

export async function deleteMyAccount(): Promise<AccountDeletionResult> {
  if (!API_BASE) {
    throw new AccountDeletionError('탈퇴 서버가 연결되어 있지 않습니다. 잠시 후 다시 시도해주세요.', 503)
  }

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new AccountDeletionError('로그인이 필요합니다.', 401)

  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new AccountDeletionError('서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.', 0)
  }

  let payload: { success?: boolean; data?: AccountDeletionResult; message?: string } | null = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new AccountDeletionError(payload?.message ?? '탈퇴 처리에 실패했습니다.', response.status)
  }

  const result = payload?.data
  return {
    keptOrders: Number(result?.keptOrders ?? 0),
    keptPayments: Number(result?.keptPayments ?? 0),
    note: String(result?.note ?? ''),
  }
}
