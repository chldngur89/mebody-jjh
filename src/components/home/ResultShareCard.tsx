/**
 * 결과 공유 카드 — hero-card 바로 아래.
 *
 * 나가는 값은 몸BTI 코드와 캐릭터 이름뿐입니다. 문항 응답·축 점수·result id 는
 * 링크에도 문구에도 넣지 않습니다(근거: src/lib/share.ts 주석).
 *
 * 기존 CTA("14일 관리 시작하기")보다 약하게 보여야 해서 outline + 텍스트 버튼을 씁니다.
 */
import { useEffect, useRef, useState } from 'react'
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
}

const TOAST_MS = 2200

export function ResultShareCard({ bodyCode, characterName, summaryLine }: ResultShareCardProps) {
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

  const payload: SharePayload = { bodyCode, characterName, summaryLine }
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

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '15px', fontWeight: 800, color: BRAND.text }}>결과 공유하기</strong>
        <span style={{ fontSize: '12px', color: BRAND.muted }}>코드와 캐릭터만 전달돼요</span>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: '13px', lineHeight: 1.6, color: BRAND.muted, wordBreak: 'keep-all' }}>
        내 답변은 함께 가지 않아요. 친구는 링크를 열면 자기 진단을 새로 시작합니다.
      </p>

      {kakaoReady && (
        <CTA variant="outline" onClick={() => void run('kakao')} disabled={busy !== null}>
          카카오톡으로 공유
        </CTA>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: kakaoReady ? '10px' : '16px' }}>
        {nativeReady && (
          <ShareTextButton label="공유하기" onClick={() => void run('native')} disabled={busy !== null} />
        )}
        <ShareTextButton label="링크 복사" onClick={() => void run('copy')} disabled={busy !== null} />
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: '10px', background: SURFACE.subtle, borderRadius: '12px',
            padding: '10px 12px', fontSize: '13px', color: BRAND.text, wordBreak: 'keep-all',
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
            marginTop: '8px', width: '100%', boxSizing: 'border-box',
            border: `1px solid ${SURFACE.hairline}`, borderRadius: '12px',
            padding: '11px 12px', fontSize: '13px', fontFamily: 'inherit',
            color: BRAND.text, background: '#ffffff',
          }}
        />
      )}
    </Card>
  )
}

function ShareTextButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
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
      }}
    >
      {label}
    </button>
  )
}
