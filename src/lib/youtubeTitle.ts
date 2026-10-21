/**
 * 유튜브 제목을 **영상에서 직접** 가져옵니다.
 *
 * 왜 필요한가
 *   결과 화면의 영상 제목은 코드에 손으로 적어 둔 라벨이었습니다. 영상을 바꾸고
 *   라벨을 안 고치면 **다른 영상 제목이 그대로 남습니다.** 실제로 그랬습니다 —
 *   라벨은 「코어 근육 … 2단계 코어 강화 루틴」인데 열리는 영상은 마사지볼
 *   목·어깨 이완이었습니다(2026-10-21 확인). 사용자는 누르기 전까지 알 수 없습니다.
 *
 *   사람이 두 곳을 맞춰야 하는 구조는 언젠가 어긋납니다. 제목은 영상이 가진
 *   값이므로 영상에서 받아옵니다.
 *
 * 어떻게
 *   유튜브 oEmbed 는 키가 없어도 되고 CORS 로 열립니다(운영 도메인에서 확인).
 *   실패하면 **조용히 지나갑니다** — 제목이 없다고 화면이 막히면 안 됩니다.
 *   호출부가 저장된 라벨을 그대로 쓰게 두고, 받아온 것이 있을 때만 덮어씁니다.
 */

const OEMBED = 'https://www.youtube.com/oembed'
const TIMEOUT_MS = 4000

/** 영상 id → 실제 제목. 못 받은 id 는 **키 자체가 없습니다.** */
export async function fetchYoutubeTitles(videoIds: string[]): Promise<Record<string, string>> {
  if (typeof fetch !== 'function' || videoIds.length === 0) return {}

  const unique = [...new Set(videoIds.filter(Boolean))]
  const results = await Promise.allSettled(
    unique.map(async (id) => {
      const url = `${OEMBED}?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as { title?: unknown }
      const title = String(body?.title ?? '').trim()
      if (!title) throw new Error('empty title')
      return [id, title] as const
    }),
  )

  const out: Record<string, string> = {}
  for (const r of results) {
    if (r.status === 'fulfilled') out[r.value[0]] = r.value[1]
  }
  return out
}
