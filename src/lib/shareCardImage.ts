/**
 * 공유용 카드 이미지(캔버스) — 외부 라이브러리 없이 그립니다.
 * 카톡에 이미지로 보내거나 앨범에 저장할 때 씁니다.
 */
import { PRODUCT } from '../theme/copy'
import { getCharacterStorageUrl } from '../utils/characterImages'
import { buildShareUrl, shareBaseUrl, type SharePayload } from './share'

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
  ctx.fillText(PRODUCT.mark, W / 2, 168)

  const charUrl = getCharacterStorageUrl(payload.bodyCode)
  const charImg = charUrl ? await loadImage(charUrl) : null
  // 원본은 1024×1536 입니다. 예전 224×322 는 비율이 미묘하게 달라 캐릭터가 눌려 보였습니다.
  const CHAR_H = 300
  const CHAR_TOP = 182
  const charBottom = CHAR_TOP + CHAR_H
  if (charImg) {
    const iw = Math.round((CHAR_H * 1024) / 1536)
    ctx.drawImage(charImg, (W - iw) / 2, CHAR_TOP, iw, CHAR_H)
  }

  const codeBaseline = charImg ? charBottom + 76 : 520
  const nameBaseline = codeBaseline + 56

  ctx.fillStyle = '#016B38'
  ctx.font = `800 104px ${FONT}`
  ctx.fillText(payload.bodyCode, W / 2, codeBaseline)

  ctx.fillStyle = '#014725'
  ctx.font = `800 48px ${FONT}`
  ctx.fillText(payload.characterName, W / 2, nameBaseline)

  const title = payload.shareTitle?.trim() || `내 ${PRODUCT.codeName}는 ${payload.bodyCode}`
  const desc =
    payload.shareDescription?.trim() ||
    payload.summaryLine?.trim() ||
    payload.tendencyLine?.trim() ||
    ''

  /*
    ── 세로 자리를 **계산해서** 나눕니다 ───────────────────────────────────────

    예전에는 상수를 손으로 박아 뒀습니다. 제목 시작 y 는 706, 축 블록 상단은 710.
    그런데 그리기 조건이 `y > axisTop - 16` 이라 **706 > 694 가 항상 참**이어서
    제목이 **한 줄도 그려지지 않았습니다.** 값을 4px 늘려 통과시켜 봐야
    36px 글자(아래로 ~8px)와 34px 헤더(위로 ~26px)가 그대로 겹칩니다.
    자리가 없는 것이지 조건이 잘못된 것이 아니었습니다.

    그래서 위 블록(마크·그림·코드·이름)에서 52px 를 돌려받고, 아래 축 블록의
    행 높이를 남은 공간에 맞춰 줄입니다. 한 줄이 안 들어가면 **말줄임이 아니라
    글자를 줄여서** 넣습니다 — 조용히 사라지는 것이 가장 나쁩니다.
  */
  const axes = payload.axes ?? []
  const HEAD_H = 52
  const footerY = H - 120

  // 이름 아래 한 줄. 코드·캐릭터명은 바로 위에 이미 크게 있으므로 **유형명**을
  // 우선합니다(결과 화면의 순서와 같습니다: 코드 → 캐릭터명 → 유형명).
  const subtitle = payload.identityTitle?.trim() || title
  const SUB_LH = 44
  const subtitleTop = nameBaseline + 50

  ctx.fillStyle = '#2C5544'
  let subPx = 36
  ctx.font = `700 ${subPx}px ${FONT}`
  let subLines = wrapText(ctx, subtitle, W - 240).slice(0, 2)
  // 두 줄을 넘기면 축 자리를 먹습니다. 줄 수를 줄이는 대신 글자를 줄입니다.
  while (subLines.length > 1 && subPx > 28) {
    subPx -= 2
    ctx.font = `700 ${subPx}px ${FONT}`
    subLines = wrapText(ctx, subtitle, W - 240).slice(0, 2)
  }

  for (let i = 0; i < subLines.length; i += 1) {
    ctx.fillText(subLines[i], W / 2, subtitleTop + i * SUB_LH)
  }

  // 마지막 제목 줄 baseline 에서 56px 아래가 축 헤더 baseline 입니다.
  // (제목은 아래로 ~8px, 헤더는 위로 ~26px 뻗으므로 22px 가 실제 간격입니다)
  const axisTop = axes.length > 0
    ? subtitleTop + (subLines.length - 1) * SUB_LH + 56
    : footerY

  // 남은 세로를 행 수로 나눕니다. 108 이 기존 값이고, 100 보다 좁아지면
  // 트랙과 다음 축 이름이 붙으므로 거기서 멈춥니다.
  const ROW_H = axes.length > 0
    ? Math.max(100, Math.min(108, Math.floor((footerY - 36 - (axisTop + HEAD_H)) / axes.length)))
    : 108

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
  ctx.fillText(PRODUCT.codeWithGuide, W / 2, H - 140)

  // **주소를 그려 넣습니다.**
  //
  // 이미지로 공유하면 링크가 따라가지 않는 경우가 많습니다(앨범 저장, 캡처 후 전달,
  // files 만 받는 앱). 그러면 받은 사람이 카드를 보고도 **돌아올 길이 없습니다.**
  // 그림 안에 주소가 있으면 적어도 쳐서 들어올 수 있습니다.
  ctx.fillStyle = '#014725'
  ctx.font = `800 30px ${FONT}`
  ctx.fillText(shareBaseUrl().replace(/^https?:\/\//, ''), W / 2, H - 88)

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

  // **링크를 반드시 같이 보냅니다.**
  //
  // 예전에는 files·title·text 만 보냈습니다. 그래서 가장 많이 눌리는 버튼(카드 이미지
  // 공유)으로 나간 공유가 **돌아올 길 없는 그림 한 장**이었습니다. 받은 사람이 마음에
  // 들어도 들어올 방법이 없습니다 — 바이럴이 거기서 끊깁니다.
  //
  // url 필드는 파일을 함께 보낼 때 무시하는 앱이 많아서 **본문에도 한 줄 넣습니다.**
  const link = buildShareUrl(payload.bodyCode, payload.axes)
  const body = `${payload.shareDescription || payload.summaryLine || ''}\n${link}`.trim()

  if (nav && typeof nav.canShare === 'function' && nav.canShare({ files: [file] }) && typeof nav.share === 'function') {
    try {
      await nav.share({
        files: [file],
        title: payload.shareTitle || `내 ${PRODUCT.codeName}`,
        text: body,
        url: link,
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
