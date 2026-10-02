/**
 * 원본 이미지를 **표시 크기에 맞게 한 번만 줄여** 쓰는 캐시.
 *
 * ── 왜 필요한가
 * 마켓 상품 사진은 766x540 인데 카드의 사진 상자는 156x110 입니다. 15장을 한꺼번에
 * 들고 있으면 디코딩된 비트맵만 24MB 가 됩니다(766x540x4 x 15). 화면에 그리는 데
 * 실제로 필요한 건 그 1/3 도 안 됩니다.
 *
 * 안드로이드 WebView 에서 마켓 탭만 스크롤을 위아래로 흔들 때 화면이 찢어졌습니다.
 * 미션·루틴 탭은 멀쩡했고, 이미지를 지우면 바로 멀쩡해졌습니다. 다른 탭과의 차이는
 * 이 사진들뿐이었습니다.
 *
 * ── 왜 서버에서 안 줄이나
 * Supabase 이미지 변환(/storage/v1/render/image/...)이 이 요금제에서 403 입니다.
 * 요금제를 올리거나 업로드할 때 줄여 넣는 쪽이 더 좋습니다. 그 전까지는 여기서 줄입니다.
 *
 * ── 어떻게
 * 받아서 createImageBitmap 의 resize 로 줄이고 캔버스에 그려 blob 으로 바꿉니다.
 * 같은 주소는 두 번 처리하지 않습니다(Map 캐시). blob 주소는 세션 동안 들고 있습니다 —
 * 15장이면 몇 백 KB 라 거둬들일 이유가 없고, 거두면 다시 스크롤할 때 또 만들어야 합니다.
 *
 * 실패하면 **원본 주소를 그대로 돌려줍니다.** 사진이 안 보이는 것보다 큰 사진이 낫습니다.
 */

/** 주소 → 줄인 blob 주소. 진행 중인 작업도 같은 Map 에 담아 중복 요청을 막습니다. */
const cache = new Map<string, Promise<string>>()

function supported(): boolean {
  return typeof createImageBitmap === 'function' && typeof document !== 'undefined'
}

async function shrink(url: string, width: number, height: number): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`이미지를 받지 못했습니다: ${response.status}`)
  const bitmap = await createImageBitmap(await response.blob(), {
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: 'high',
  })
  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('캔버스를 쓸 수 없습니다')
    context.drawImage(bitmap, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82))
    if (!blob) throw new Error('이미지를 변환하지 못했습니다')
    return URL.createObjectURL(blob)
  } finally {
    bitmap.close()
  }
}

/**
 * 줄인 이미지 주소를 돌려줍니다. 줄일 수 없으면 원본 주소 그대로입니다.
 *
 * @param width  줄일 가로 — 화면에 그릴 크기의 2배쯤으로 잡습니다(고해상도 화면 대비).
 * @param height 줄일 세로 — **원본 비율과 같게** 주세요. 다르면 사진이 찌그러집니다.
 */
export function thumbnail(url: string, width: number, height: number): Promise<string> {
  if (!supported()) return Promise.resolve(url)
  const key = `${url}|${width}x${height}`
  const hit = cache.get(key)
  if (hit) return hit
  const task = shrink(url, width, height).catch(() => url)
  cache.set(key, task)
  return task
}
