import { useEffect, useRef } from 'react'
import { QuestionHeroMedia } from '../QuestionHeroMedia'

interface QuestionGuidePanelProps {
  mediaKey: string
  mediaSrc: string | null
  mediaType?: string | null
  title?: string
  part?: string
  guideText: string
}

function findScrollParent(start: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = start?.parentElement ?? null
  while (node) {
    const { overflowY } = window.getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return node
    }
    node = node.parentElement
  }
  return null
}

/**
 * 선택지 아래: 미디어(사진이 있을 때만) + 연초록 가이드 박스 1개
 *
 * 답 선택 후 항상 초록 안내로 시선을 내립니다.
 * 상단 메인 접힘/유지는 QuestionMediaLayout(옵션 가이드 미디어 유무)이 담당합니다.
 */
export function QuestionGuidePanel({
  mediaKey,
  mediaSrc,
  mediaType,
  title,
  part,
  guideText,
}: QuestionGuidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth'

    requestAnimationFrame(() => {
      const scrollParent = findScrollParent(panel)
      if (!scrollParent) return

      const parentRect = scrollParent.getBoundingClientRect()
      const panelRect = panel.getBoundingClientRect()
      const delta =
        panelRect.top - parentRect.top - (parentRect.height / 2 - panelRect.height / 2)
      scrollParent.scrollTo({
        top: scrollParent.scrollTop + delta,
        behavior,
      })
    })
  }, [mediaKey, mediaSrc, guideText])

  return (
    <div ref={panelRef} id="question-guide-panel" className="animate-slide-up-in w-full space-y-4">
      <QuestionHeroMedia
        mediaKey={`guide-${mediaKey}`}
        src={mediaSrc}
        mediaType={mediaType}
        title={title}
        part={part}
        className="mx-auto px-0"
        height="clamp(120px, 24dvh, 240px)"
        hideWhenEmpty
      />
      <div className="rounded-2xl bg-emerald-50 px-5 py-4">
        <p className="text-sm font-bold text-emerald-700">이렇게 확인해 보세요</p>
        <p className="mt-2 text-sm leading-relaxed text-gray-700" style={{ wordBreak: 'keep-all' }}>
          {guideText}
        </p>
      </div>
    </div>
  )
}
