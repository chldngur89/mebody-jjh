import { SUPABASE_STORAGE_PUBLIC } from './supabase'

/** Bump when Storage question assets are remastered (same path, new bytes). */
const QUESTION_MEDIA_CACHE_VERSION = '20260909r'

function withCacheBust(url: string): string {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}v=${QUESTION_MEDIA_CACHE_VERSION}`
}

/**
 * questions.media_url 해석
 * - 절대 URL → 그대로
 * - 상대 경로/키 → Supabase Storage `images` 버킷 public URL
 * - 비어 있으면 null (UI는 soft placeholder)
 */
export function resolveQuestionMediaUrl(mediaUrl?: string | null): string | null {
  if (!mediaUrl) return null
  const trimmed = mediaUrl.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return withCacheBust(trimmed)
  }

  if (!SUPABASE_STORAGE_PUBLIC) return null

  const path = trimmed.replace(/^\//, '')
  return withCacheBust(`${SUPABASE_STORAGE_PUBLIC}/${path}`)
}
