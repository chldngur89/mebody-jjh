import { useEffect, useRef, useState } from 'react'

interface QuestionHeroMediaProps {
  mediaKey: string
  src: string | null
  title?: string
  part?: string
  className?: string
  /**
   * 슬롯 높이(CSS 값).
   * 고정 320px 정사각형이면 작은 화면(375×667)에서 선택지가 화면 밖으로 밀립니다.
   * 그래서 기본값을 화면 높이에 묶어 두고, 필요한 곳만 다르게 줍니다.
   */
  height?: string
  /** 사진이 없으면 아예 그리지 않습니다(자리표시자도 안 만듭니다) */
  hideWhenEmpty?: boolean
  /**
   * questions.media_type. 'video' 면 <video> 로 재생합니다.
   *
   * 사진 소재를 움직이게 하려면 mp4 가 유일하게 현실적입니다 —
   * 같은 2초 클립 기준 mp4 92KB / 애니메이션 WebP 635KB / GIF 6.6MB / APNG 11.8MB 였습니다.
   */
  mediaType?: string | null
}

/** 확장자로도 판단합니다. media_type 을 안 채운 행이 있을 수 있습니다. */
function isVideoSource(src: string | null, mediaType?: string | null): boolean {
  if (mediaType && mediaType.toLowerCase() === 'video') return true
  if (!src) return false
  return /\.(mp4|webm|mov)(\?|$)/i.test(src)
}

function isImageLoaded(img: HTMLImageElement | null): boolean {
  return Boolean(img?.complete && img.naturalHeight > 0)
}

/**
 * 선택 단계 상단 미디어 슬롯.
 * Supabase media_url이 있으면 이미지/GIF를 표시하고, 없으면 soft placeholder를 유지한다.
 */
/** 화면이 짧을수록 작아지고, 커도 300px 을 넘지 않습니다. */
export const DEFAULT_HERO_HEIGHT = 'clamp(150px, 28dvh, 300px)'

export function QuestionHeroMedia({
  mediaKey,
  src,
  title,
  part,
  className = '',
  height = DEFAULT_HERO_HEIGHT,
  hideWhenEmpty = false,
  mediaType,
}: QuestionHeroMediaProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setReady(false)
    setFailed(false)
    if (!src) return
    // 동영상은 <video> 의 onLoadedData 가 준비 상태를 알려줍니다.
    if (isVideoSource(src, mediaType)) return

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
  }, [mediaKey, src, mediaType])

  const isVideo = isVideoSource(src, mediaType)
  const showImage = Boolean(src) && !failed

  // 사진이 없는 문항·로드 실패(가이드)에서 빈 자리를 만들지 않습니다.
  if (hideWhenEmpty && (!src || failed)) return null

  const showLoadingPulse = Boolean(src) && !failed && !ready

  return (
    <div
      className={`relative mx-auto w-full max-w-[320px] shrink-0 ${className}`}
      style={{ height }}
      data-question-hero-media
    >
      {showLoadingPulse ? (
        <div className="absolute inset-0 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-teal-50">
          <div className="absolute inset-6 rounded-[28px] border border-emerald-100/80 bg-white/50" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 h-12 w-12 shrink-0 animate-pulse rounded-full bg-emerald-100/80" />
            {(part || title) && (
              <p className="text-sm font-bold text-gray-600" style={{ wordBreak: 'keep-all' }}>
                {[part ? `${part}파트` : null, title].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {failed && !hideWhenEmpty ? (
        <div className="absolute inset-0 overflow-hidden rounded-3xl bg-emerald-50/80">
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            {(part || title) && (
              <p className="text-sm font-bold text-gray-600" style={{ wordBreak: 'keep-all' }}>
                {[part ? `${part}파트` : null, title].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {showImage && isVideo ? (
        <video
          key={src!}
          src={src!}
          // 소리 없이 자동으로 반복 재생합니다. muted + playsInline 이 없으면
          // 모바일 브라우저와 WebView 가 자동재생을 막습니다.
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          controls={false}
          className={`absolute inset-0 m-auto h-full w-full object-contain transition-opacity duration-300 ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
          onLoadedData={() => setReady(true)}
          onError={() => {
            setFailed(true)
            setReady(true)
          }}
        />
      ) : null}

      {showImage && !isVideo ? (
        <img
          ref={imgRef}
          key={src}
          src={src!}
          alt=""
          decoding="async"
          loading="eager"
          // React 18 은 camelCase fetchPriority 를 모릅니다(19부터 지원).
          // 소문자로 넘겨야 경고 없이 DOM 속성으로 전달됩니다.
          {...{ fetchpriority: 'high' }}
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
