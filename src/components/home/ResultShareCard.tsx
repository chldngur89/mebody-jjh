/**
 * 결과 공유 블록 — hero 카드 안에 붙이거나 단독 카드로 쓸 수 있습니다.
 *
 * 나가는 값은 몸BTI 코드와 캐릭터 이름뿐입니다. 문항 응답·축 점수·result id 는
 * 링크에도 문구에도 넣지 않습니다(근거: src/lib/share.ts 주석).
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link2 } from 'lucide-react'
import { Card, CTA } from '../ui'
import { BRAND, SURFACE } from '../../theme/brand'
import { track, type ShareChannel } from '../../lib/analytics'
import {
  buildShareUrl,
  canNativeShare,
  copyShareLink,
  isShareableBodyCode,
  shareNative,
  trackShareOutcome,
  type SharePayload,
} from '../../lib/share'
import { isKakaoShareConfigured, preloadKakao, shareToKakao } from '../../lib/kakao'

export interface ResultShareCardProps {
  bodyCode: string
  characterName: string
  summaryLine?: string
  tendencyLine?: string
  /** true 이면 바깥 Card 없이 내용만 렌더합니다(hero 와 한 박스로 합칠 때). */
  embedded?: boolean
}

const TOAST_MS = 2200

export function ResultShareCard({
  bodyCode,
  characterName,
  summaryLine,
  tendencyLine,
  embedded = false,
}: ResultShareCardProps) {
  const [toast, setToast] = useState<string | null>(null)
  /**
   * 복사가 막힌 환경(카카오 인앱 브라우저, 구형 웹뷰, 비 HTTPS)에서 직접 복사할 주소.
   * 주소창을 복사하라고 안내하면 안 됩니다. 거기에는 결과 id 가 들어 있습니다.
   */
  const [manualUrl, setManualUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState<ShareChannel | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shareable = isShareableBodyCode(bodyCode)

  useEffect(() => {
    if (!shareable) return
    track('result_share_opened', { body_code: bodyCode })
    preloadKakao()
  }, [shareable, bodyCode])

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  if (!shareable) return null

  const payload: SharePayload = { bodyCode, characterName, summaryLine, tendencyLine }
  const kakaoReady = isKakaoShareConfigured()
  const nativeReady = canNativeShare()

  const showToast = (message: string) => {
    setToast(message)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setToast(null), TOAST_MS)
  }

  const run = async (channel: ShareChannel) => {
    if (busy) return
    setBusy(channel)
    track('result_share_clicked', { share_channel: channel, body_code: bodyCode })

    try {
      if (channel === 'copy') {
        const url = buildShareUrl(bodyCode)
        const copied = await copyShareLink(url)
        trackShareOutcome('copy', bodyCode, copied ? 'shared' : 'failed')
        setManualUrl(copied ? null : url)
        showToast(copied ? '링크를 복사했어요' : '복사가 막혀 있어요. 아래 주소를 눌러 직접 복사해 주세요')
        return
      }

      const outcome = channel === 'kakao' ? await shareToKakao(payload) : await shareNative(payload)
      trackShareOutcome(channel, bodyCode, outcome)

      // 사용자가 공유창을 닫은 것(cancelled)은 오류가 아니라서 아무 말도 하지 않습니다.
      if (outcome === 'failed') showToast('공유를 마치지 못했어요. 링크 복사를 써 주세요')
      else if (outcome === 'unsupported') {
        showToast(channel === 'kakao' ? '카카오 공유를 아직 쓸 수 없어요' : '이 기기에서는 공유창을 열 수 없어요')
      }
    } finally {
      setBusy(null)
    }
  }

  const body = (
    <div style={{ textAlign: 'center' }}>
      <strong
        style={{
          display: 'block',
          fontSize: '15px',
          fontWeight: 800,
          color: BRAND.text,
          letterSpacing: '-0.02em',
        }}
      >
        결과 공유하기
      </strong>
      <p
        style={{
          margin: '6px 0 0',
          fontSize: '12.5px',
          lineHeight: 1.5,
          color: BRAND.muted,
          wordBreak: 'keep-all',
        }}
      >
        코드와 캐릭터가 전달되요
      </p>

      {kakaoReady && (
        <CTA
          variant="outline"
          onClick={() => void run('kakao')}
          disabled={busy !== null}
          style={{ marginTop: '14px' }}
        >
          카카오톡으로 공유
        </CTA>
      )}

      <div
        style={{
          display: 'grid',
          gap: '8px',
          marginTop: kakaoReady ? '8px' : '14px',
        }}
      >
        {nativeReady && (
          <ShareActionButton label="공유하기" onClick={() => void run('native')} disabled={busy !== null} />
        )}
        <ShareActionButton
          label="링크 복사"
          icon={<Link2 size={15} strokeWidth={2.4} />}
          onClick={() => void run('copy')}
          disabled={busy !== null}
          primary
        />
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: '10px',
            background: SURFACE.subtle,
            borderRadius: '12px',
            padding: '10px 12px',
            fontSize: '13px',
            color: BRAND.text,
            wordBreak: 'keep-all',
            textAlign: 'left',
          }}
        >
          {toast}
        </div>
      )}

      {manualUrl && (
        <input
          readOnly
          value={manualUrl}
          aria-label="공유 링크"
          onFocus={(event) => event.currentTarget.select()}
          onClick={(event) => event.currentTarget.select()}
          style={{
            marginTop: '8px',
            width: '100%',
            boxSizing: 'border-box',
            border: `1px solid ${SURFACE.hairline}`,
            borderRadius: '12px',
            padding: '11px 12px',
            fontSize: '13px',
            fontFamily: 'inherit',
            color: BRAND.text,
            background: '#ffffff',
            textAlign: 'left',
          }}
        />
      )}
    </div>
  )

  if (embedded) {
    return (
      <div
        style={{
          marginTop: '18px',
          paddingTop: '18px',
          borderTop: `1px solid ${SURFACE.hairline}`,
        }}
      >
        {body}
      </div>
    )
  }

  return <Card>{body}</Card>
}

function ShareActionButton({
  label,
  onClick,
  disabled,
  primary = false,
  icon,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  primary?: boolean
  icon?: ReactNode
}) {
  const style: CSSProperties = primary
    ? {
        width: '100%',
        border: `1.5px solid ${BRAND.green}`,
        background: BRAND.green,
        borderRadius: '14px',
        padding: '13px 14px',
        color: '#ffffff',
        fontWeight: 800,
        fontSize: '14px',
        fontFamily: 'inherit',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '7px',
      }
    : {
        width: '100%',
        border: `1px solid ${SURFACE.hairline}`,
        background: '#ffffff',
        borderRadius: '12px',
        padding: '11px 12px',
        color: BRAND.green,
        fontWeight: 800,
        fontSize: '13px',
        fontFamily: 'inherit',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }

  return (
    <button type="button" onClick={onClick} disabled={disabled} style={style}>
      {icon}
      {label}
    </button>
  )
}
