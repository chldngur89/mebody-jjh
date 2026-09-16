import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type UIEvent } from 'react';
import { BRAND_PAGE_BG, SURFACE } from '../theme/brand';
import { CTA, PRODUCT } from '../theme/copy';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { preferredScrollBehavior } from '../lib/viewport';
import { useMediaQuery } from '../utils/useMediaQuery';
import { AxisIntroDemo } from './AxisIntroDemo';

interface DiagnosisIntroScreenProps {
  onBack?: () => void;
  onBegin: () => void;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('button, a, input, label, textarea, select, [role="button"]'));
}

export function DiagnosisIntroScreen({ onBack, onBegin }: DiagnosisIntroScreenProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)');
  const screenHeight = isDesktopMockup ? '100%' : 'var(--mebody-app-height)';
  /** 화면이 짧으면 축 설명 줄을 접어 헤드라인과 CTA 사이를 줄입니다. */
  const isShortViewport = useMediaQuery('(max-height: 760px)');

  const [canBegin, setCanBegin] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const unlockIfAtBottom = (el: HTMLDivElement) => {
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollTop + clientHeight >= scrollHeight - 16) {
      setCanBegin(true);
    }
  };

  const refreshScrollState = () => {
    const content = contentRef.current;
    if (!content) return;
    const scrollable = content.scrollHeight > content.clientHeight + 12;
    if (!scrollable) {
      setCanBegin(true);
      return;
    }
    unlockIfAtBottom(content);
  };

  const handleContentScroll = (event: UIEvent<HTMLDivElement>) => {
    unlockIfAtBottom(event.currentTarget);
  };

  const scrollToBottom = () => {
    const el = contentRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: preferredScrollBehavior() });
  };

  const handleSurfaceClick = (event: ReactMouseEvent) => {
    if (isInteractiveTarget(event.target)) return;
    scrollToBottom();
  };

  useEffect(() => {
    const content = contentRef.current;
    const bottom = bottomRef.current;

    refreshScrollState();
    const animationFrame = window.requestAnimationFrame(refreshScrollState);
    const timer = window.setTimeout(refreshScrollState, 400);
    const observer =
      content && bottom && 'IntersectionObserver' in window
        ? new IntersectionObserver(
            ([entry]) => {
              if (entry?.isIntersecting) setCanBegin(true);
            },
            { root: content, threshold: 0.6 },
          )
        : null;

    observer?.observe(bottom!);
    window.addEventListener('resize', refreshScrollState);
    return () => {
      observer?.disconnect();
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timer);
      window.removeEventListener('resize', refreshScrollState);
    };
  }, []);

  return (
    <div
      className="mebody-app-surface"
      onClick={handleSurfaceClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        height: screenHeight,
        minHeight: screenHeight,
        maxHeight: screenHeight,
        borderRadius: isDesktopMockup ? '32px' : 0,
        background: BRAND_PAGE_BG,
        boxShadow: isDesktopMockup ? '0 24px 60px rgba(1, 71, 37, 0.13)' : 'none',
        boxSizing: 'border-box',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: '40px',
            left: '-84px',
            width: '280px',
            height: '280px',
            borderRadius: '999px',
            background: 'rgba(0, 70, 40, 0.035)',
            filter: 'blur(58px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '-96px',
            width: '300px',
            height: '300px',
            borderRadius: '999px',
            background: 'rgba(0, 70, 40, 0.03)',
            filter: 'blur(72px)',
          }}
        />
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          height: '100%',
          flexDirection: 'column',
          padding: isDesktopMockup ? '16px 20px 16px' : '8px 12px 8px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '24px',
            background: 'rgba(255,255,255,0.96)',
            boxShadow: '0 18px 40px rgba(1, 71, 37, 0.1)',
            position: 'relative',
          }}
        >
          <div
            ref={contentRef}
            onScroll={handleContentScroll}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: isDesktopMockup ? '20px 20px 18px' : '14px 14px 12px',
              WebkitOverflowScrolling: 'touch',
              minHeight: 0,
            }}
          >
            <div style={{ marginBottom: '14px', textAlign: 'center', position: 'relative' }}>
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  aria-label="뒤로"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '44px',
                    height: '44px',
                    borderRadius: '999px',
                    border: '1px solid #E1E9DA',
                    background: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                    zIndex: 2,
                  }}
                >
                  <ArrowLeft size={18} color="#2C5544" />
                </button>
              )}
              <div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.04em', color: '#014725', marginBottom: '8px' }}>
                측정 축 · {PRODUCT.codeName}
              </div>
              <h1
                style={{
                  fontSize: isDesktopMockup ? '1.5rem' : '1.3125rem',
                  lineHeight: 1.3,
                  fontWeight: 850,
                  color: '#014725',
                  marginBottom: '8px',
                  wordBreak: 'keep-all',
                  letterSpacing: '-0.04em',
                }}
              >
                아래 4개 축을 기준으로
                <br />
                나의 {PRODUCT.codeName}를 계산합니다
              </h1>
            </div>

            {/* 안내 문구는 제목과 4축 사이에서 자기 칸을 갖습니다 —
                제목에 붙여 두면 어디까지가 제목인지 눈으로 갈라지지 않았습니다. */}
            <div
              style={{
                marginBottom: '12px',
                borderRadius: '14px',
                background: SURFACE.subtle,
                padding: isShortViewport ? '10px 12px' : '12px 14px',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '0.8125rem',
                  lineHeight: 1.55,
                  color: '#3D6B54',
                  textAlign: 'center',
                  wordBreak: 'keep-all',
                }}
              >
                정답을 맞히는 방식이 아니라, 지금 몸이 더 가깝게 느끼는 방향을 선택해주면 됩니다.
              </p>
            </div>

            <div style={{ maxWidth: '420px', margin: '0 auto' }}>
              <AxisIntroDemo compact={isShortViewport} />
            </div>

            <div
              style={{
                marginTop: '12px',
                borderRadius: '16px',
                border: '1px solid rgba(1, 71, 37, 0.12)',
                background: 'rgba(228,244,240,0.82)',
                padding: '14px',
              }}
            >
              <p style={{ fontSize: '0.8125rem', lineHeight: 1.55, color: '#466e65', textAlign: 'center', wordBreak: 'keep-all' }}>
                같은 자세를 오래 유지할수록 일상에서 쓰는 몸 습관이 더 잘 드러납니다.
                <br />
                지금 몸이 자주 쓰는 방향을 떠올리며 답해주세요.
              </p>
            </div>

            <div ref={bottomRef} style={{ height: '16px' }} />
          </div>

          <div
            style={{
              padding: '12px 16px 14px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.94) 42%, rgba(255,255,255,0.98) 100%)',
              boxShadow: '0 -14px 24px rgba(255,255,255,0.88)',
            }}
          >
            {/* 버튼 바로 위에 둡니다. 스크롤 끝에 두면 이 바에 가려 잘렸습니다. */}
            <p
              style={{
                margin: '0 0 8px',
                fontSize: '0.75rem',
                lineHeight: 1.45,
                fontWeight: 700,
                color: canBegin ? '#014725' : '#587761',
                textAlign: 'center',
                wordBreak: 'keep-all',
              }}
            >
              {canBegin ? '준비됐습니다. 아래 버튼을 눌러 분석을 시작해주세요.' : '아래로 조금만 더 내리면 분석 버튼이 열립니다.'}
            </p>
            <button
              type="button"
              onClick={canBegin ? onBegin : scrollToBottom}
              aria-disabled={!canBegin}
              style={{
                display: 'inline-flex',
                width: '100%',
                height: '54px',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: '16px',
                border: 'none',
                background: canBegin
                  ? 'linear-gradient(90deg, #016B38 0%, #014725 100%)'
                  : 'linear-gradient(90deg, #E1E9DA 0%, #C8D6C4 100%)',
                color: canBegin ? '#ffffff' : '#587761',
                fontSize: '1rem',
                fontWeight: 800,
                boxShadow: canBegin ? '0 14px 28px rgba(1,71,37,0.25)' : 'none',
                cursor: 'pointer',
              }}
            >
              {canBegin ? CTA.diagnosisStart : CTA.introLocked}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
