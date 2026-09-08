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

/**
 * 선택지 아래: 미디어(사진이 있을 때만) + 연초록 가이드 박스 1개
 *
 * 가이드 이미지가 있을 때만 자동으로 시야를 아래로 맞춥니다.
 * (A1처럼 안내 문구만 있는 문항은 시선을 억지로 내리지 않습니다.)
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
  const hasGuideMedia = Boolean(mediaSrc)

  useEffect(() => {
    if (!hasGuideMedia) return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'center',
      })
    })
  }, [hasGuideMedia, mediaKey, mediaSrc])

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
