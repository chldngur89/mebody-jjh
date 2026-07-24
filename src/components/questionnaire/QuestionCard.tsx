import { Check } from 'lucide-react'
import type { Question } from '../../api/questionnaire'
import type { QuestionPhase } from './types'

interface QuestionCardProps {
  question: Question
  phase: QuestionPhase
  selectedAnswer?: string
  onAnswer: (value: string) => void
  axisLabel: string
}

export function QuestionCard({
  question,
  phase,
  selectedAnswer,
  onAnswer,
  axisLabel,
}: QuestionCardProps) {
  const options: { value: string; label: string; muted?: boolean }[] = [
    { value: '①', label: question.option_1 },
    { value: '②', label: question.option_2, muted: true },
    { value: '③', label: question.option_3 },
  ]
  const isGuidePhase = phase === 'guide'

  return (
    <>
      <div className="mb-5 inline-flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
          <span className="text-sm font-semibold text-emerald-600">{question.question_code}</span>
        </div>
        <span className="text-sm text-gray-500">{axisLabel}</span>
      </div>

      <h2
        className={`font-bold leading-relaxed text-gray-900 ${
          isGuidePhase ? 'mb-5 text-lg' : 'mb-8 text-xl'
        }`}
        style={{ wordBreak: 'keep-all' }}
      >
        {question.question_text}
      </h2>

      <div className="space-y-3">
        {options.map((option) => {
          const isSelected = selectedAnswer === option.value

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onAnswer(option.value)}
              className={`group flex min-h-[72px] w-full items-center justify-between rounded-2xl border-2 px-5 text-left font-semibold transition-all active:scale-[0.98] ${
                isGuidePhase ? 'py-4' : 'py-5'
              } ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-50 text-gray-900'
                  : option.muted
                    ? 'border-gray-200 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                    : 'border-gray-200 text-gray-900 hover:border-emerald-500 hover:bg-emerald-50'
              } ${isGuidePhase && !isSelected ? 'opacity-75' : ''}`}
            >
              <span className="pr-3 text-base leading-snug" style={{ wordBreak: 'keep-all' }}>
                {option.label}
              </span>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500'
                    : option.muted
                      ? 'border-gray-300 group-hover:border-gray-400'
                      : 'border-gray-300 group-hover:border-emerald-500 group-hover:bg-emerald-500'
                }`}
              >
                <Check
                  className={`h-5 w-5 transition-colors ${
                    isSelected
                      ? 'text-white'
                      : option.muted
                        ? 'text-transparent'
                        : 'text-transparent group-hover:text-white'
                  }`}
                />
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}
