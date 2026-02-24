/**
 * 문항별 placeholder 이미지 (Ver2 — 실제 이미지 교체 전 임시)
 * 현재 축의 Ver2 아이콘 표시
 */

import { AXIS_ICON_SRC } from '../data/axisIcons'
import type { AxisKey } from '../data/axisIcons'

interface QuestionPlaceholderImageProps {
  questionNumber: number
  axis?: AxisKey
  className?: string
}

export function QuestionPlaceholderImage({ questionNumber, axis, className = '' }: QuestionPlaceholderImageProps) {
  const axisLabel = axis === 'neck' ? '목' : axis === 'shoulder' ? '어깨' : axis === 'pelvis' ? '골반' : axis === 'flexibility' ? '유연성' : ''

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-dashed border-gray-300 text-gray-500 ${className}`}
      aria-hidden
    >
      {axis && (
        <img
          src={AXIS_ICON_SRC[axis]}
          alt=""
          className="w-12 h-12 object-contain mt-2 mb-1"
        />
      )}
      <div className="text-center p-2">
        <div className="text-2xl font-bold text-gray-400 mb-0.5">Q{questionNumber}</div>
        {axisLabel && <div className="text-xs font-medium text-gray-500">{axisLabel} 측정</div>}
        <div className="text-xs text-gray-400 mt-0.5">이미지 영역</div>
      </div>
    </div>
  )
}
