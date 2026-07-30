import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles, UserRound } from 'lucide-react'
import { fetchQuestions, saveDraft } from '../api/questionnaire'
import type { Question } from '../api/questionnaire'
import type { AnswerMap } from '../utils/bodyCodeCalculator'
import { QuestionCard } from './questionnaire/QuestionCard'
import { QuestionMediaLayout } from './questionnaire/QuestionMediaLayout'
import { QuestionNavBar } from './questionnaire/QuestionNavBar'
import type { QuestionPhase } from './questionnaire/types'

interface QuestionnaireScreenProps {
  onBack?: () => void
  onComplete: (answers: AnswerMap, questions: Question[], questionnaireId?: string) => void
  isLoggedIn?: boolean
  userEmail?: string
  onOpenMyPage?: () => void
  onRequireAuth?: () => void
}

const AXIS_SHORT: Record<string, string> = {
  neck: '목',
  shoulder: '어깨',
  pelvis: '골반',
  flexibility: '하체',
  none: '일상',
}

function getAxisLabel(question: Question) {
  if (question.part && question.title) return `${question.part}파트 · ${question.title}`
  if (question.title) return question.title
  return AXIS_SHORT[question.axis] || '체형 체크'
}

function getGuideText(question: Question) {
  const instruction = question.instruction?.trim()
  if (instruction) return instruction
  const guide = question.guide_text?.trim()
  if (guide) return guide
  return '선택하신 답을 바탕으로 몸의 경향을 확인하고 있어요. 다음으로 넘어가기 전에 한 번 더 떠올려 보세요.'
}

export function QuestionnaireScreen({
  onBack,
  onComplete,
  isLoggedIn = false,
  onOpenMyPage,
  onRequireAuth,
}: QuestionnaireScreenProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<QuestionPhase>('select')
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [questionnaireId, setQuestionnaireId] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const totalQuestions = questions.length || 32
  const progress = questions.length
    ? ((currentIndex + (phase === 'guide' ? 0.5 : 0)) / totalQuestions) * 100
    : 0

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const loadQuestions = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const data = await fetchQuestions()
      setQuestions(data)
      if (!data.length) {
        setLoadError('문항 데이터가 비어 있습니다. Supabase questions(mebody_v1_32)를 확인해주세요.')
      }
    } catch (error) {
      console.error('Failed to load questions:', error)
      setLoadError('문항을 불러오지 못했습니다. 네트워크나 Supabase 연결을 확인해주세요.')
      setQuestions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadQuestions()
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [loadQuestions])

  useEffect(() => {
    setPhase('select')
  }, [currentIndex])

  const currentQuestion = questions[currentIndex]
  const nextQuestion = questions[currentIndex + 1]
  const nextNextQuestion = questions[currentIndex + 2]
  const selectedAnswer = currentQuestion ? answers[currentQuestion.question_code] : undefined

  const saveDraftDebounced = useCallback(
    async (newAnswers: AnswerMap) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const result = await saveDraft(newAnswers, questionnaireId)
          if (!questionnaireId) setQuestionnaireId(result.id)
        } catch (error) {
          console.error('Failed to save draft:', error)
        }
      }, 3000)
    },
    [questionnaireId],
  )

  const finish = useCallback(
    (nextAnswers: AnswerMap) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      onComplete(nextAnswers, questions, questionnaireId)
    },
    [onComplete, questionnaireId, questions],
  )

  /** TEMP: 진행바↔미디어 사이 — 미응답 문항을 ②로 채우고 결과로 이동 */
  const handleTempSkipToResult = useCallback(() => {
    if (!questions.length) return
    const filled: AnswerMap = { ...answers }
    for (const q of questions) {
      if (!filled[q.question_code]) filled[q.question_code] = '②'
    }
    setAnswers(filled)
    finish(filled)
  }, [answers, finish, questions])

  const handleAnswer = useCallback(
    (value: string) => {
      if (!currentQuestion) return
      const nextAnswers = { ...answers, [currentQuestion.question_code]: value }
      setAnswers(nextAnswers)
      saveDraftDebounced(nextAnswers)

      if (phase === 'guide') return
      setPhase('guide')
    },
    [answers, currentQuestion, phase, saveDraftDebounced],
  )

  const handleGuidePrev = useCallback(() => {
    if (currentIndex <= 0) {
      onBack?.()
      return
    }
    const prevIndex = currentIndex - 1
    const prev = questions[prevIndex]
    setCurrentIndex(prevIndex)
    setPhase(prev && answers[prev.question_code] ? 'guide' : 'select')
  }, [answers, currentIndex, onBack, questions])

  const handleGuideNext = useCallback(() => {
    if (!currentQuestion) return
    if (currentIndex < totalQuestions - 1) {
      setPhase('select')
      setCurrentIndex((index) => index + 1)
      return
    }
    finish(answers)
  }, [answers, currentIndex, currentQuestion, finish, totalQuestions])

  const handleAccountAction = isLoggedIn ? onOpenMyPage : onRequireAuth

  if (isLoading) {
    return (
      <div className="mebody-app-surface overflow-hidden rounded-3xl shadow-xl" style={{ minHeight: '100dvh' }}>
        <div className="flex h-full flex-col px-6 pb-8 pt-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-4 py-2 shadow-sm">
            <Sparkles size={17} color="#014725" />
            <span className="text-xs font-black tracking-wide text-gray-800">MEBODY</span>
          </div>
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">LOADING</p>
            <p className="mt-2 text-sm font-bold text-emerald-950" style={{ wordBreak: 'keep-all' }}>
              32문항을 준비하고 있습니다.
            </p>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-emerald-300 to-teal-300" />
          </div>
        </div>
      </div>
    )
  }

  if (loadError || !currentQuestion) {
    return (
      <div className="mebody-app-surface overflow-hidden rounded-3xl shadow-xl" style={{ minHeight: '100dvh' }}>
        <div className="flex h-full flex-col px-6 py-10">
          <h2 className="mb-3 text-2xl font-black text-gray-900">문항을 준비하지 못했습니다</h2>
          <p className="mb-5 text-sm font-bold text-gray-600" style={{ wordBreak: 'keep-all' }}>
            {loadError || '현재 표시할 문항이 없습니다.'}
          </p>
          <button
            type="button"
            onClick={loadQuestions}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-sm font-black text-white"
          >
            문항 다시 불러오기
          </button>
          {onBack && (
            <button type="button" onClick={onBack} className="mt-3 text-sm font-bold text-gray-500">
              뒤로
            </button>
          )}
        </div>
      </div>
    )
  }

  const isGuidePhase = phase === 'guide'
  const guideText = getGuideText(currentQuestion)

  return (
    <div className="mebody-app-surface overflow-hidden rounded-3xl shadow-xl" style={{ minHeight: '100dvh' }}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 px-6 pt-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-4 py-2 shadow-sm">
            <Sparkles size={16} color="#014725" />
            <span className="text-xs font-black tracking-wide text-gray-800">MEBODY</span>
          </div>
          {handleAccountAction && (
            <button
              type="button"
              onClick={handleAccountAction}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-4 text-xs font-extrabold text-emerald-700"
            >
              <UserRound size={15} />
              {isLoggedIn ? '내 페이지' : '로그인'}
            </button>
          )}
        </div>

        <div className="px-6 pb-4 pt-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">
              질문 {currentIndex + 1} / {totalQuestions}
            </span>
            <span className="text-sm font-semibold text-emerald-600">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>

        <div className="px-6 pb-2">
          <button
            type="button"
            onClick={handleTempSkipToResult}
            className="w-full rounded-2xl border border-dashed border-orange-300 bg-orange-50 px-4 py-2.5 text-xs font-bold text-orange-700 transition-all hover:bg-orange-100 active:scale-[0.98]"
          >
            [임시] 32문항 채우고 결과 보기
          </button>
        </div>

        <QuestionMediaLayout
          stepKey={currentQuestion.question_code}
          phase={phase}
          guideText={guideText}
          question={currentQuestion}
          nextQuestion={nextQuestion}
          nextNextQuestion={nextNextQuestion}
        >
          <QuestionCard
            question={currentQuestion}
            phase={phase}
            selectedAnswer={selectedAnswer}
            onAnswer={handleAnswer}
            axisLabel={getAxisLabel(currentQuestion)}
          />
        </QuestionMediaLayout>

        {isGuidePhase ? (
          <QuestionNavBar
            onPrev={handleGuidePrev}
            onNext={handleGuideNext}
            isLastQuestion={currentIndex === totalQuestions - 1}
            canGoPrev={currentIndex > 0 || Boolean(onBack)}
          />
        ) : null}
      </div>
    </div>
  )
}
