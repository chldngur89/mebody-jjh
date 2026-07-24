import { useEffect, useRef } from 'react'
import { QuestionHeroMedia } from '../QuestionHeroMedia'
import type { QuestionPhase } from './types'

interface QuestionGuidePanelProps {
  mediaKey: string
  mediaSrc: string | null
  title?: string
  part?: string
  guideText: string
  phase: QuestionPhase
  stepKey: string | number
}

/** 선택지 아래: 미디어 슬롯(항상) + 연초록 가이드 박스 1개 */
export function QuestionGuidePanel({
  mediaKey,
  mediaSrc,
  title,
  part,
  guideText,
  phase,
  stepKey,
}: QuestionGuidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (phase !== 'guide') return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'center',
      })
    })
  }, [phase, stepKey])

  return (
    <div ref={panelRef} id="question-guide-panel" className="animate-slide-up-in w-full space-y-4">
      <QuestionHeroMedia
        mediaKey={`guide-${mediaKey}`}
        src={mediaSrc}
        title={title}
        part={part}
        className="mx-auto px-0"
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
