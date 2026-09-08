import { useEffect, type ReactNode } from 'react'
import { QuestionHeroMedia } from '../QuestionHeroMedia'
import { FadeSlidePanel } from './FadeSlidePanel'
import { QuestionGuidePanel } from './QuestionGuidePanel'
import type { Question } from '../../api/questionnaire'
import { resolveQuestionMediaUrl } from '../../lib/questionMedia'
import { getOptionGuideMediaUrl, hasOptionGuideMedia } from '../../lib/questionOptionMedia'
import type { QuestionPhase } from './types'

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
