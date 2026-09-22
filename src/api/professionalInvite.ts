/**
 * 전문가 초대 — 고객 쪽.
 *
 * 트레이너가 만든 링크(`/?invite=<token>`)를 열면 이 모듈이 쓰입니다.
 *
 * 설계상 지켜야 할 것 두 가지입니다.
 *
 * 1. **미리보기는 전문가 이름만.** 로그인 전에 "누가 불렀는지" 는 알려야 합니다. 모르는 링크에
 *    로그인하라고 할 수는 없으니까요. 그 대신 그 이상은 알려주지 않습니다.
 * 2. **동의는 로그인한 본인만.** 서버가 토큰이 가리키는 사람이 아니라 *지금 로그인한 사람* 을
 *    고객으로 묶습니다. 그래서 링크를 주운 사람이 남의 계정을 연결할 수 없습니다.
 */
import { supabase } from '../lib/supabase'

const API_BASE = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

export class InviteError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'InviteError'
    this.status = status
  }
}

export interface InvitePreview {
  valid: boolean
  reason?: string
  professionalName?: string
  professionalType?: string
  expiresAt?: string
}

export interface InviteAccepted {
  relationId: string
  professionalName: string
  consentedAt: string
  /** 결과가 이미 있으면 바로 보여줄 수 있고, 없으면 32문항부터 해야 합니다. */
  hasResult: boolean
}

/** URL 에서 초대 토큰을 읽습니다. 형식이 아니면 무시합니다(주소창에 아무거나 들어올 수 있습니다). */
export function readInviteToken(search: string): string | undefined {
  const raw = new URLSearchParams(search).get('invite')
  if (!raw) return undefined
  const token = raw.trim()
  // 서버가 32바이트를 base64url 로 내보냅니다 — 43자. 길이·문자만 먼저 거릅니다.
  return /^[A-Za-z0-9_-]{20,128}$/.test(token) ? token : undefined
}

async function readJson(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/** 로그인 없이 부를 수 있습니다. 없는 토큰과 만료 토큰의 답이 같습니다. */
export async function previewInvite(token: string): Promise<InvitePreview> {
  if (!API_BASE) throw new InviteError('서버가 연결되어 있지 않습니다.', 503)

  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/public/professional/invite/${encodeURIComponent(token)}`)
  } catch {
    throw new InviteError('서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.', 0)
  }

  const payload = await readJson(response)
  if (!response.ok) throw new InviteError(payload?.message ?? '초대를 확인하지 못했습니다.', response.status)

  const data = payload?.data ?? payload
  return {
    valid: Boolean(data?.valid),
    reason: data?.reason ?? undefined,
    professionalName: data?.professionalName ?? undefined,
    professionalType: data?.professionalType ?? undefined,
    expiresAt: data?.expiresAt ?? undefined,
  }
}

/** 동의. 로그인 상태여야 합니다. */
export async function acceptInvite(token: string): Promise<InviteAccepted> {
  if (!API_BASE) throw new InviteError('서버가 연결되어 있지 않습니다.', 503)

  const { data: session } = await supabase.auth.getSession()
  const accessToken = session.session?.access_token
  if (!accessToken) throw new InviteError('로그인이 필요합니다.', 401)

  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/invites/${encodeURIComponent(token)}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    throw new InviteError('서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.', 0)
  }

  const payload = await readJson(response)
  if (!response.ok) throw new InviteError(payload?.message ?? '동의 처리에 실패했습니다.', response.status)

  const data = payload?.data ?? payload
  return {
    relationId: String(data?.relationId ?? ''),
    professionalName: String(data?.professionalName ?? '전문가'),
    consentedAt: String(data?.consentedAt ?? ''),
    hasResult: Boolean(data?.hasResult),
  }
}

export interface MyProfessional {
  relationId: string
  professionalName: string
  professionalType: string
  status: 'INVITED' | 'ACTIVE' | 'REVOKED'
  consentedAt?: string
}

/** 내가 결과를 보여주기로 한 전문가 목록. */
export async function listMyProfessionals(): Promise<MyProfessional[]> {
  if (!API_BASE) throw new InviteError('서버가 연결되어 있지 않습니다.', 503)

  const { data: session } = await supabase.auth.getSession()
  const accessToken = session.session?.access_token
  if (!accessToken) throw new InviteError('로그인이 필요합니다.', 401)

  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/invites/relations`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    throw new InviteError('서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.', 0)
  }

  const payload = await readJson(response)
  if (!response.ok) throw new InviteError(payload?.message ?? '목록을 불러오지 못했습니다.', response.status)

  const rows = (payload?.data ?? []) as Array<Record<string, unknown>>
  return rows.map((row) => ({
    relationId: String(row.relationId ?? ''),
    professionalName: String(row.professionalName ?? '전문가'),
    professionalType: String(row.professionalType ?? ''),
    status: (row.status as MyProfessional['status']) ?? 'INVITED',
    consentedAt: row.consentedAt ? String(row.consentedAt) : undefined,
  }))
}

/** 동의 거두기. 마이페이지에서 씁니다. */
export async function withdrawConsent(relationId: string): Promise<void> {
  if (!API_BASE) throw new InviteError('서버가 연결되어 있지 않습니다.', 503)

  const { data: session } = await supabase.auth.getSession()
  const accessToken = session.session?.access_token
  if (!accessToken) throw new InviteError('로그인이 필요합니다.', 401)

  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/invites/relations/${encodeURIComponent(relationId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    throw new InviteError('서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.', 0)
  }

  if (!response.ok) {
    const payload = await readJson(response)
    throw new InviteError(payload?.message ?? '해지에 실패했습니다.', response.status)
  }
}
