/**
 * window.confirm() 대체.
 *
 * 네이티브 confirm 은 버튼이 항상 "확인/취소" 라서 (1) 무슨 일이 일어나는지
 * 버튼에 적히지 않고 (2) 기본 포커스가 확인으로 간다. 주문 취소·멤버십 해지처럼
 * 되돌리기 어려운 동작에는 둘 다 위험하다.
 *
 * <dialog>.showModal() 을 쓰므로 포커스 트랩·Esc 닫기·배경 inert 는 브라우저가 처리한다.
 * 호출부는 한 줄로 남는다:
 *
 *   if (!(await confirmDialog({ title: '…', confirmLabel: '주문 취소하기' }))) return
 */
import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { BRAND, BRAND_CARD_BORDER } from '../theme/brand'

const DANGER = '#8E3A32' // 앱 공통 오류색. 흰 글씨 7.50:1 · 크림 위 7.44:1

export interface ConfirmOptions {
  title: string
  body?: string
  /** 파괴적 동작의 이름을 그대로 적는다 — "확인" 이 아니라 "주문 취소하기" */
  confirmLabel: string
  cancelLabel?: string
  /** 되돌릴 수 없는 동작이면 true(기본). 확인 버튼이 붉어지고 기본 포커스가 취소로 간다. */
  destructive?: boolean
}

function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: (ok: boolean) => void }) {
  const { title, body, confirmLabel, cancelLabel = '취소', destructive = true } = options
  const ref = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    ref.current?.showModal()
    // 파괴적 동작에서 기본 포커스는 취소에 둔다.
    ;(destructive ? cancelRef : confirmRef).current?.focus()
  }, [destructive])

  const close = (ok: boolean) => {
    ref.current?.close()
    onClose(ok)
  }

  const button = {
    minHeight: '44px',
    padding: '0 18px',
    border: '1px solid transparent',
    borderRadius: '999px',
    fontFamily: 'inherit',
    fontSize: '0.9375rem',
    fontWeight: 700,
    lineHeight: 1,
    cursor: 'pointer',
  } as const

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault()
        close(false)
      }}
      onClick={(event) => {
        if (event.target === ref.current) close(false)
      }}
      style={{
        width: 'min(24rem, calc(100vw - 32px))',
        padding: '22px',
        border: BRAND_CARD_BORDER,
        borderRadius: '18px',
        background: BRAND.card,
        color: BRAND.text,
        fontFamily: 'inherit',
        boxShadow: '0 24px 60px var(--mebody-d-k28-2, rgba(1, 31, 17, 0.28))',
      }}
    >
      <h2 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 900, letterSpacing: '-0.01em', wordBreak: 'keep-all' }}>
        {title}
      </h2>
      {body && (
        <p style={{ margin: '10px 0 0', fontSize: '0.875rem', lineHeight: 1.6, color: BRAND.muted, wordBreak: 'keep-all' }}>
          {body}
        </p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
        <button
          ref={cancelRef}
          type="button"
          onClick={() => close(false)}
          style={{ ...button, borderColor: BRAND.line, background: 'transparent', color: BRAND.text }}
        >
          {cancelLabel}
        </button>
        <button
          ref={confirmRef}
          type="button"
          onClick={() => close(true)}
          style={{ ...button, background: destructive ? DANGER : BRAND.green, color: 'var(--mebody-t-ffffff-2, #ffffff)' }}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const finish = (ok: boolean) => {
      resolve(ok)
      // React 이벤트 처리 중 unmount 하면 경고가 난다 — 한 틱 뒤에 정리한다.
      window.setTimeout(() => {
        root.unmount()
        host.remove()
      }, 0)
    }
    root.render(<ConfirmDialog options={options} onClose={finish} />)
  })
}
