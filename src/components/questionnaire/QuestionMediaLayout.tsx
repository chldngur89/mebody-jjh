import { useEffect, type ReactNode } from 'react'
import { QuestionHeroMedia } from '../QuestionHeroMedia'
import { FadeSlidePanel } from './FadeSlidePanel'
import { QuestionGuidePanel } from './QuestionGuidePanel'
import type { Question } from '../../api/questionnaire'
import { resolveQuestionMediaUrl } from '../../lib/questionMedia'
import type { QuestionPhase } from './types'

interface QuestionMediaLayoutProps {
  stepKey: string | number
  phase: QuestionPhase
  guideText?: string
  question: Question
  nextQuestion?: Question
  nextNextQuestion?: Question
  children: ReactNode
}

/**
 * select: 상단 미디어 + 하단 문항
 * guide: 상단 접힘 → 선택지 아래 미디어 + 연초록 가이드
 */
export function QuestionMediaLayout({
  stepKey,
  phase,
  guideText,
  question,
  nextQuestion,
  nextNextQuestion,
  children,
}: QuestionMediaLayoutProps) {
  const mediaSrc = resolveQuestionMediaUrl(question.media_url)
  const showTopMedia = phase === 'select'
  const isGuidePhase = phase === 'guide'
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
  }, [nextQuestion?.media_url, nextNextQuestion?.media_url])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          showTopMedia ? 'max-h-[360px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <QuestionHeroMedia
          mediaKey={String(question.media_url ?? stepKey)}
          src={mediaSrc}
          title={question.title}
          part={question.part}
          className="px-4 pt-2"
        />
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-3 ${
          isGuidePhase ? 'justify-start' : 'justify-end'
        }`}
      >
        <FadeSlidePanel key={stepKey}>
          {isGuidePhase ? (
            <div className="flex flex-col gap-5 py-2">
              {children}
              <QuestionGuidePanel
                mediaKey={String(question.media_url ?? stepKey)}
                mediaSrc={mediaSrc}
                title={question.title}
                part={question.part}
                guideText={resolvedGuideText}
                phase={phase}
                stepKey={stepKey}
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
