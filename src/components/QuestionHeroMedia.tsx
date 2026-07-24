import { useEffect, useRef, useState } from 'react'

interface QuestionHeroMediaProps {
  mediaKey: string
  src: string | null
  title?: string
  part?: string
  className?: string
}

function isImageLoaded(img: HTMLImageElement | null): boolean {
  return Boolean(img?.complete && img.naturalHeight > 0)
}

/**
 * 선택 단계 상단 미디어 슬롯.
 * Supabase media_url이 있으면 이미지/GIF를 표시하고, 없으면 soft placeholder를 유지한다.
 */
export function QuestionHeroMedia({
  mediaKey,
  src,
  title,
  part,
  className = '',
}: QuestionHeroMediaProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setReady(false)
    setFailed(false)
    if (!src) return

    const el = imgRef.current
    if (isImageLoaded(el)) {
      setReady(true)
      return
    }

    const probe = new Image()
    const markReady = () => setReady(true)
    const markFailed = () => {
      setFailed(true)
      setReady(true)
    }
    probe.onload = markReady
    probe.onerror = markFailed
    probe.src = src
    if (probe.complete && probe.naturalHeight > 0) markReady()

    return () => {
      probe.onload = null
      probe.onerror = null
    }
  }, [mediaKey, src])

  const showImage = Boolean(src) && !failed

  return (
    <div
      className={`relative mx-auto w-full max-w-[320px] shrink-0 ${className}`}
      style={{ minHeight: 280, aspectRatio: '1 / 1' }}
      data-question-hero-media
    >
      {!showImage || !ready ? (
        <div className="absolute inset-0 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-teal-50">
          <div className="absolute inset-6 rounded-[28px] border border-emerald-100/80 bg-white/50" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 h-16 w-16 animate-pulse rounded-full bg-emerald-100/80" />
            {(part || title) && (
              <p className="text-sm font-bold text-gray-600" style={{ wordBreak: 'keep-all' }}>
                {[part ? `${part}파트` : null, title].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {showImage ? (
        <img
          ref={imgRef}
          key={src}
          src={src!}
          alt=""
          decoding="async"
          loading="eager"
          fetchPriority="high"
          className={`absolute inset-0 m-auto h-full w-full object-contain transition-opacity duration-300 ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setReady(true)}
          onError={() => {
            setFailed(true)
            setReady(true)
          }}
        />
      ) : null}
    </div>
  )
}
