import { useEffect, useState } from 'react'
import { AXIS_ICON_FALLBACK_SRC, AXIS_ICON_SRC } from '../data/axisIcons'
import type { AxisKey } from '../data/axisIcons'

interface QuestionPlaceholderImageProps {
  questionNumber: number
  axis?: AxisKey
  className?: string
}

export function QuestionPlaceholderImage({ questionNumber, axis, className = '' }: QuestionPlaceholderImageProps) {
  const axisLabel = axis === 'neck' ? '목' : axis === 'shoulder' ? '어깨' : axis === 'pelvis' ? '골반' : axis === 'flexibility' ? '유연성' : ''
  const [iconSrc, setIconSrc] = useState(axis ? AXIS_ICON_SRC[axis] : '')
  const [iconFailed, setIconFailed] = useState(false)

  useEffect(() => {
    setIconSrc(axis ? AXIS_ICON_SRC[axis] : '')
    setIconFailed(false)
  }, [axis])

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white text-gray-500 ${className}`}
      aria-hidden
    >
      {axis && iconSrc && !iconFailed && (
        <img
          src={iconSrc}
          alt=""
          className="w-12 h-12 object-contain mt-2 mb-1"
          onError={() => {
            if (iconSrc !== AXIS_ICON_FALLBACK_SRC[axis]) {
              setIconSrc(AXIS_ICON_FALLBACK_SRC[axis])
              return
            }
            setIconFailed(true)
          }}
        />
      )}
      {axis && iconFailed && (
        <div className="mt-2 mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-black text-emerald-700">
          {axisLabel}
        </div>
      )}
      <div className="text-center p-2">
        <div className="text-2xl font-bold text-gray-400 mb-0.5">Q{questionNumber}</div>
        {axisLabel && <div className="text-xs font-medium text-gray-500">{axisLabel} 측정</div>}
        <div className="text-xs text-gray-400 mt-0.5">이미지 영역</div>
      </div>
    </div>
  )
}
