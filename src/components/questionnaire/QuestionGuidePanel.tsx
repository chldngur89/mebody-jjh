import { useEffect, useRef } from 'react'
import { QuestionHeroMedia } from '../QuestionHeroMedia'
import { preferredScrollBehavior } from '../../lib/viewport'
import { findScrollParent } from './findScrollParent'

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
 * 답 선택 후 스크롤을 하단(다음 버튼 쪽)으로 내려 확인을 유도합니다.
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

    const behavior = preferredScrollBehavior()

    const scrollTowardNext = () => {
      const scrollParent = findScrollParent(panel)
      if (!scrollParent) return
      scrollParent.scrollTo({
        top: scrollParent.scrollHeight,
        behavior,
      })
    }

    // 가이드 패널·이미지가 펼쳐진 뒤 높이가 잡히도록 두 번 맞춥니다.
    const frame = window.requestAnimationFrame(() => {
      scrollTowardNext()
      window.setTimeout(scrollTowardNext, 280)
    })

    return () => window.cancelAnimationFrame(frame)
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
