interface QuestionNavBarProps {
  onPrev: () => void
  onNext: () => void
  isLastQuestion?: boolean
  canGoPrev?: boolean
}

export function QuestionNavBar({
  onPrev,
  onNext,
  isLastQuestion = false,
  canGoPrev = true,
}: QuestionNavBarProps) {
  return (
    <div className="animate-slide-up-in shrink-0 border-t border-gray-100 bg-white px-6 py-4">
      <p className="mb-3 text-center text-xs leading-relaxed text-gray-500" style={{ wordBreak: 'keep-all' }}>
        확인이 되었다면 아래 {isLastQuestion ? '「결과 보기」' : '「다음」'}을 눌러 주세요.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canGoPrev}
          className="flex-1 rounded-2xl border-2 border-gray-200 py-3.5 text-sm font-semibold text-gray-700 transition-all hover:border-gray-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300 disabled:hover:border-gray-100"
        >
          이전
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:brightness-105 active:scale-[0.98]"
        >
          {isLastQuestion ? '결과 보기' : '다음'}
        </button>
      </div>
    </div>
  )
}
