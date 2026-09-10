import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type UIEvent } from 'react';
import { BRAND_PAGE_BG } from '../theme/brand';
import { CTA, PRODUCT } from '../theme/copy';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { preferredScrollBehavior } from '../lib/viewport';
import { useMediaQuery } from '../utils/useMediaQuery';
import { ScrollIndicator } from './ScrollIndicator';

interface DiagnosisIntroScreenProps {
  onBack?: () => void;
  onBegin: () => void;
}

const INTRO_AXES_IMAGE = '/intro-axes.png';

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('button, a, input, label, textarea, select, [role="button"]'));
}

export function DiagnosisIntroScreen({ onBegin }: DiagnosisIntroScreenProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)');
  const screenHeight = isDesktopMockup ? '100%' : 'var(--mebody-app-height)';

  const [canBegin, setCanBegin] = useState(false);
  const [needsScroll, setNeedsScroll] = useState(false);
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
    setNeedsScroll(scrollable);
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
        boxShadow: isDesktopMockup ? '0 24px 60px rgba(15, 23, 42, 0.13)' : 'none',
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
            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.1)',
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
            <div style={{ marginBottom: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.16em', color: '#014725', marginBottom: '8px' }}>
                측정 축 · {PRODUCT.codeGuide}
              </div>
              <h1
                style={{
                  fontSize: isDesktopMockup ? '24px' : '21px',
                  lineHeight: 1.3,
                  fontWeight: 850,
                  color: '#111827',
                  marginBottom: '8px',
                  wordBreak: 'keep-all',
                  letterSpacing: '-0.04em',
                }}
              >
                아래 4개 축을 기준으로
                <br />
                나의 {PRODUCT.codeName}를 계산합니다
              </h1>
              <p style={{ fontSize: '13px', lineHeight: 1.55, color: '#4b5563', wordBreak: 'keep-all' }}>
                정답을 맞히는 방식이 아니라, 지금 몸이 더 가깝게 느끼는 방향을 선택해주면 됩니다.
              </p>
            </div>

            <img
              src={INTRO_AXES_IMAGE}
              alt="축 1 목 위치, 축 2 어깨 높이, 축 3 골반 회전, 축 4 하체 유연성"
              onLoad={refreshScrollState}
              draggable={false}
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                maxWidth: '420px',
                margin: '0 auto',
                borderRadius: '18px',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                pointerEvents: 'none',
              }}
            />

            <div
              style={{
                marginTop: '12px',
                borderRadius: '16px',
                border: '1px solid rgba(1, 71, 37, 0.12)',
                background: 'rgba(228,244,240,0.82)',
                padding: '14px',
              }}
            >
              <p style={{ fontSize: '13px', lineHeight: 1.55, color: '#466e65', textAlign: 'center', wordBreak: 'keep-all' }}>
                같은 자세를 오래 유지할수록 몸의 사용 패턴이 더 선명하게 드러납니다.
                <br />
                지금 몸이 자주 쓰는 방향을 떠올리며 답해주세요.
              </p>
            </div>

            <div ref={bottomRef} style={{ height: '16px' }} />
          </div>

          <ScrollIndicator containerRef={contentRef} bottomOffset="118px" />

          {!canBegin && needsScroll && (
            <button
              type="button"
              onClick={scrollToBottom}
              style={{
                position: 'absolute',
                left: '50%',
                bottom: '118px',
                transform: 'translateX(-50%)',
                zIndex: 21,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '999px',
                border: '1px solid rgba(1, 71, 37, 0.18)',
                background: 'rgba(255,255,255,0.96)',
                padding: '8px 14px',
                color: '#014725',
                fontSize: '12px',
                fontWeight: 800,
                boxShadow: '0 10px 22px rgba(15, 23, 42, 0.12)',
                cursor: 'pointer',
              }}
            >
              <ChevronDown size={14} strokeWidth={3} />
              아래로 스크롤 · 화면을 탭하세요
            </button>
          )}

          <div
            style={{
              padding: '12px 16px 14px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.94) 42%, rgba(255,255,255,0.98) 100%)',
              boxShadow: '0 -14px 24px rgba(255,255,255,0.88)',
            }}
          >
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
                  : 'linear-gradient(90deg, #e5e7eb 0%, #d1d5db 100%)',
                color: canBegin ? '#ffffff' : '#94a3b8',
                fontSize: '16px',
                fontWeight: 800,
                boxShadow: canBegin ? '0 14px 28px rgba(1,71,37,0.25)' : 'none',
                cursor: 'pointer',
              }}
            >
              {canBegin ? CTA.diagnosisStart : CTA.introLocked}
              <ArrowRight size={18} />
            </button>
            {!canBegin && (
              <p
                style={{
                  marginTop: '8px',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#94a3b8',
                }}
              >
                아무 곳이나 탭하면 아래로 내려가며, 끝까지 보면 시작할 수 있어요
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
