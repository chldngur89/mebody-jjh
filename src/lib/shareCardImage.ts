/**
 * 공유용 카드 이미지(캔버스) — 외부 라이브러리 없이 그립니다.
 * 카톡에 이미지로 보내거나 앨범에 저장할 때 씁니다.
 */
import { PRODUCT } from '../theme/copy'
import { getCharacterStorageUrl } from '../utils/characterImages'
import type { SharePayload } from './share'

const W = 1080
const H = 1350
/** 홈페이지·앱과 같은 서체. 페이지에서 이미 로드돼 있으므로 캔버스에서도 씁니다. */
const FONT = '"Pretendard Variable", Pretendard, "Noto Sans KR", sans-serif'

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth) {
      line = next
    } else {
      if (line) lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 4)
}

export async function renderShareCardBlob(payload: SharePayload): Promise<Blob | null> {
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // background
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#F7FBF6')
  grad.addColorStop(1, '#E8F3EA')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // card
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, 72, 96, W - 144, H - 192, 48)
  ctx.fill()

  ctx.fillStyle = '#014725'
  ctx.font = `700 36px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText(PRODUCT.mark, W / 2, 180)

  const charUrl = getCharacterStorageUrl(payload.bodyCode)
  const charImg = charUrl ? await loadImage(charUrl) : null
  if (charImg) {
    const iw = 224
    const ih = 322
    ctx.drawImage(charImg, (W - iw) / 2, 196, iw, ih)
  }

  ctx.fillStyle = '#016B38'
  ctx.font = `800 104px ${FONT}`
  ctx.fillText(payload.bodyCode, W / 2, charImg ? 596 : 520)

  ctx.fillStyle = '#014725'
  ctx.font = `800 48px ${FONT}`
  ctx.fillText(payload.characterName, W / 2, charImg ? 654 : 600)

  const title = payload.shareTitle?.trim() || `내 ${PRODUCT.codeName}는 ${payload.bodyCode}`
  const desc =
    payload.shareDescription?.trim() ||
    payload.summaryLine?.trim() ||
    payload.tendencyLine?.trim() ||
    ''

  // 축 블록의 자리를 먼저 잡습니다. 제목이 길어도 여기를 침범하지 못하게 합니다.
  const axes = payload.axes ?? []
  const ROW_H = 108
  const HEAD_H = 52
  const footerY = H - 120
  const axisTop = axes.length > 0 ? footerY - 36 - axes.length * ROW_H - HEAD_H : footerY

  ctx.fillStyle = '#2C5544'
  ctx.font = `600 36px ${FONT}`
  const titleLines = wrapText(ctx, title, W - 240)
  let y = charImg ? 706 : 700
  for (const line of titleLines) {
    if (y > axisTop - 16) break // 축 자리를 넘지 않습니다
    ctx.fillText(line, W / 2, y)
    y += 48
  }

  // 설명 문구는 이미지에 넣지 않습니다 — 공유 메시지(text)에 들어가고,
  // 여기서는 4축이 들어갈 자리를 남겨야 합니다.
  void desc

  // ── 4축 상세 결과 ─────────────────────────────────────────────
  // 화면의 '4축 상세 결과' 카드와 같은 내용입니다. 코드만 있는 이미지로는
  // 받는 사람이 무슨 뜻인지 알 수 없어서 축까지 넣습니다.
  if (axes.length > 0) {
    const padX = 140
    const trackW = W - padX * 2
    let ay = axisTop

    ctx.textAlign = 'left'
    ctx.fillStyle = '#014725'
    ctx.font = `800 34px ${FONT}`
    ctx.fillText('4축 상세 결과', padX, ay)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#587761'
    ctx.font = `700 24px ${FONT}`
    ctx.fillText('중앙에 가까울수록 균형', W - padX, ay)
    ay += HEAD_H

    for (const axis of axes) {
      // 축 이름을 먼저. 트랙 아래에 두면 다음 축의 것처럼 읽힙니다.
      ctx.textAlign = 'left'
      ctx.fillStyle = '#014725'
      ctx.font = `800 28px ${FONT}`
      ctx.fillText(axis.title.replace(/\s*(위치|높이|회전|유연성)$/, ''), padX, ay)
      ay += 34

      ctx.font = `600 24px ${FONT}`
      ctx.fillStyle = '#4A6B58'
      ctx.fillText(axis.labelLeft, padX, ay)
      ctx.textAlign = 'right'
      ctx.fillText(axis.labelRight, W - padX, ay)
      ay += 20

      const trackH = 14
      ctx.fillStyle = '#E4EDE3'
      roundRect(ctx, padX, ay, trackW, trackH, trackH / 2)
      ctx.fill()
      ctx.fillStyle = '#B4C7B8'
      ctx.fillRect(padX + trackW / 2 - 1, ay - 5, 2, trackH + 10)

      const knobPct = Math.max(0, Math.min(100, 100 - axis.percentLeft))
      const cx = padX + (trackW * knobPct) / 100
      const cy = ay + trackH / 2
      ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill()
      ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fillStyle = '#014725'; ctx.fill()

      ay += ROW_H - 54
    }
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = '#6F8C7B'
  ctx.font = `600 28px ${FONT}`
  ctx.fillText(PRODUCT.codeWithGuide, W / 2, H - 120)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

export async function downloadShareCard(payload: SharePayload): Promise<boolean> {
  const blob = await renderShareCardBlob(payload)
  if (!blob) return false
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mebody-${payload.bodyCode}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return true
}

export async function shareShareCardImage(payload: SharePayload): Promise<'shared' | 'cancelled' | 'unsupported' | 'failed'> {
  const blob = await renderShareCardBlob(payload)
  if (!blob) return 'failed'

  const file = new File([blob], `mebody-${payload.bodyCode}.png`, { type: 'image/png' })
  const nav = typeof navigator !== 'undefined' ? navigator : null

  if (nav && typeof nav.canShare === 'function' && nav.canShare({ files: [file] }) && typeof nav.share === 'function') {
    try {
      await nav.share({
        files: [file],
        title: payload.shareTitle || `내 ${PRODUCT.codeName}`,
        text: payload.shareDescription || payload.summaryLine,
      })
      return 'shared'
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return 'cancelled'
      console.warn('shareShareCardImage failed:', error)
    }
  }

  const saved = await downloadShareCard(payload)
  return saved ? 'shared' : 'failed'
}
