import { useEffect, useRef, type ReactNode } from 'react'
import { QuestionHeroMedia } from '../QuestionHeroMedia'
import { FadeSlidePanel } from './FadeSlidePanel'
import { QuestionGuidePanel } from './QuestionGuidePanel'
import type { Question } from '../../api/questionnaire'
import { resolveQuestionMediaUrl } from '../../lib/questionMedia'
import { getOptionGuideMediaUrl, hasOptionGuideMedia } from '../../lib/questionOptionMedia'
import type { QuestionPhase } from './types'
import { preferredScrollBehavior } from '../../lib/viewport'

/** 사진을 눈에 담을 시간. 이 뒤에 선택지 쪽으로 내려 줍니다. */
const NUDGE_DELAY_MS = 520
/** 이만큼도 안 잘렸으면 그냥 둡니다. */
const MIN_NUDGE_PX = 8

interface QuestionMediaLayoutProps {
  stepKey: string | number
  phase: QuestionPhase
  guideText?: string
  question: Question
  selectedAnswer?: string
  nextQuestion?: Question
  nextNextQuestion?: Question
  children: ReactNode
}

/**
 * 상단 미디어 + 하단 문항.
 *
 * - 일반 문항(A1 등): 선택 후에도 상단 히어로를 유지해 애니메이션이 끊기지 않게 합니다.
 * - 선택지별 가이드 이미지가 있는 문항(A9/B1/B2): 선택 시 상단을 접고 하단 가이드만 보여줍니다.
 * - 상단 미디어가 보일 때는 문항을 justify-start 로 배치해 이미지가 질문을 가리지 않게 합니다.
 * - 문항이 바뀌면 아래 영역의 스크롤을 맨 위로 되돌립니다. 그러지 않으면 앞 문항에서 내려둔
 *   위치가 남아, 다음·이전으로 넘어온 순간 질문 머리가 잘린 채 나타납니다.
 * - 그리고 선택지가 조금 잘려 있을 때만 한 박자 뒤에 거기까지 부드럽게 내려 줍니다.
 *   많이 잘려 있으면 내리지 않습니다. 내리면 질문 자체가 화면 밖으로 밀려나기 때문입니다.
 */
export function QuestionMediaLayout({
  stepKey,
  phase,
  guideText,
  question,
  selectedAnswer,
  nextQuestion,
  nextNextQuestion,
  children,
}: QuestionMediaLayoutProps) {
  const mediaSrc = resolveQuestionMediaUrl(question.media_url)
  const guideMediaSrc = resolveQuestionMediaUrl(getOptionGuideMediaUrl(question, selectedAnswer))
  const isGuidePhase = phase === 'guide'
  const collapsesTopOnGuide = hasOptionGuideMedia(question)
  const showTopMedia = Boolean(mediaSrc) && !(isGuidePhase && collapsesTopOnGuide)
  const resolvedGuideText =
    guideText?.trim() ||
    '선택하신 답을 바탕으로 몸의 경향을 확인하고 있어요. 다음으로 넘어가기 전에 한 번 더 떠올려 보세요.'

  useEffect(() => {
    const preload = (url?: string | null) => {
      const src = resolveQuestionMediaUrl(url)
      if (!src) return
      const img = new Image()
      img.decoding = 'async'
      img.src = src
    }
    preload(nextQuestion?.media_url)
    preload(nextNextQuestion?.media_url)
    preload(question.media_url_option_1)
    preload(question.media_url_option_2)
    preload(question.media_url_option_3)
  }, [
    nextQuestion?.media_url,
    nextNextQuestion?.media_url,
    question.media_url_option_1,
    question.media_url_option_2,
    question.media_url_option_3,
  ])

  const contentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    // 1) 앞 문항의 스크롤 위치를 지웁니다 — 질문은 늘 머리부터 보여야 합니다.
    el.scrollTop = 0

    // 2) 사진을 한 박자 보여준 뒤, 잘린 선택지를 끝까지 내려 보여 줍니다.
    //    **질문 글이 화면에 남을 때만** 내립니다. 끝까지 내려도 질문이 밀려나지 않는 경우가
    //    거기에 해당합니다. 질문이 밀려날 만큼 길면 그냥 맨 위에 둡니다.
    //    무엇을 고르는지 모른 채 선택지만 보이는 쪽이 잘린 선택지보다 나쁩니다.
    const timer = window.setTimeout(() => {
      const node = contentRef.current
      if (!node) return
      const hidden = node.scrollHeight - node.clientHeight
      if (hidden <= MIN_NUDGE_PX) return

      const options = node.querySelector<HTMLElement>('[data-question-options]')
      const questionStaysVisible = !options || hidden <= Math.max(0, options.offsetTop - 8)
      if (!questionStaysVisible) return

      node.scrollTo({ top: hidden, behavior: preferredScrollBehavior() })
    }, NUDGE_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [stepKey, phase, showTopMedia])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      {mediaSrc ? (
        <div
          className="shrink-0 overflow-hidden transition-all duration-300 ease-out"
          style={{
            maxHeight: showTopMedia ? '320px' : 0,
            opacity: showTopMedia ? 1 : 0,
          }}
          aria-hidden={!showTopMedia}
        >
          <QuestionHeroMedia
            mediaKey={String(question.media_url ?? stepKey)}
            src={mediaSrc}
            mediaType={question.media_type}
            title={question.title}
            part={question.part}
            className="px-4 pt-2"
          />
        </div>
      ) : null}

      <div
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 ${
          showTopMedia || isGuidePhase ? 'justify-start pt-2' : 'justify-end pt-3'
        }`}
      >
        <FadeSlidePanel key={stepKey} className="w-full">
          {isGuidePhase ? (
            <div className="flex flex-col gap-5 py-2">
              {children}
              <QuestionGuidePanel
                mediaKey={`${String(question.media_url ?? stepKey)}-${selectedAnswer ?? 'none'}`}
                mediaSrc={guideMediaSrc}
                mediaType={guideMediaSrc ? 'image' : question.media_type}
                title={question.title}
                part={question.part}
                guideText={resolvedGuideText}
              />
            </div>
          ) : (
            children
          )}
        </FadeSlidePanel>
      </div>
    </div>
  )
}
