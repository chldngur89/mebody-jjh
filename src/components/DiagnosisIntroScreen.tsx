import { useEffect, useRef, useState, type UIEvent } from 'react';
import { ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { AXIS_ICON_SRC } from '../data/axisIcons';
import { AXIS_GREEN_THEME } from '../data/axisTheme';

interface DiagnosisIntroScreenProps {
  onBack?: () => void;
  onBegin: () => void;
}

const AXIS_ITEMS = [
  {
    title: '축 1. 목 위치',
    left: 'F (전방)',
    right: 'C (중앙)',
    icon: AXIS_ICON_SRC.neck,
    accent: AXIS_GREEN_THEME.deep,
    surface: AXIS_GREEN_THEME.introSurfaces[0],
    border: AXIS_GREEN_THEME.border,
  },
  {
    title: '축 2. 어깨 높이',
    left: 'R (오른쪽 높음)',
    right: 'L (왼쪽 높음)',
    icon: AXIS_ICON_SRC.shoulder,
    accent: AXIS_GREEN_THEME.deep,
    surface: AXIS_GREEN_THEME.introSurfaces[1],
    border: AXIS_GREEN_THEME.border,
  },
  {
    title: '축 3. 골반 회전',
    left: 'R (오른쪽 회전)',
    right: 'L (왼쪽 회전)',
    icon: AXIS_ICON_SRC.pelvis,
    accent: AXIS_GREEN_THEME.deep,
    surface: AXIS_GREEN_THEME.introSurfaces[2],
    border: AXIS_GREEN_THEME.border,
  },
  {
    title: '축 4. 하체 유연성',
    left: 'S (뻣뻣)',
    right: 'F (유연)',
    icon: AXIS_ICON_SRC.flexibility,
    accent: AXIS_GREEN_THEME.deep,
    surface: AXIS_GREEN_THEME.introSurfaces[3],
    border: AXIS_GREEN_THEME.border,
  },
] as const;

export function DiagnosisIntroScreen({ onBack, onBegin }: DiagnosisIntroScreenProps) {
  const [canBegin, setCanBegin] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const handleContentScroll = (event: UIEvent<HTMLDivElement>) => {
    if (canBegin) return;
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 16) {
      setCanBegin(true);
    }
  };

  useEffect(() => {
    const content = contentRef.current;
    const bottom = bottomRef.current;

    const checkScrollable = () => {
      if (!content) return;
      if (content.scrollHeight <= content.clientHeight + 80) {
        setCanBegin(true);
      }
    };

    checkScrollable();
    const animationFrame = window.requestAnimationFrame(checkScrollable);
    const timer = window.setTimeout(checkScrollable, 500);
    const observer =
      content && bottom && 'IntersectionObserver' in window
        ? new IntersectionObserver(
            ([entry]) => {
              if (entry?.isIntersecting) setCanBegin(true);
            },
            { root: content, threshold: 0.8 },
          )
        : null;

    observer?.observe(bottom);
    window.addEventListener('resize', checkScrollable);
    return () => {
      observer?.disconnect();
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timer);
      window.removeEventListener('resize', checkScrollable);
    };
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        height: '844px',
        borderRadius: '32px',
        background: 'linear-gradient(145deg, #ecfdf5 0%, #f3fdfb 42%, #f0fdfa 100%)',
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.13)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: '56px',
            left: '-84px',
            width: '300px',
            height: '300px',
            borderRadius: '999px',
            background: 'rgba(52, 211, 153, 0.16)',
            filter: 'blur(58px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            right: '-96px',
            width: '320px',
            height: '320px',
            borderRadius: '999px',
            background: 'rgba(45, 212, 191, 0.15)',
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
          padding: '22px 24px 20px',
          fontFamily: '"SUIT Variable","Pretendard Variable","Noto Sans KR",sans-serif',
        }}
      >
        <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.4)',
              background: 'rgba(255,255,255,0.72)',
              padding: '9px 16px',
              boxShadow: '0 10px 20px rgba(15, 23, 42, 0.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Sparkles size={18} color="#059669" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937' }}>MEBODY</span>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.4)',
                background: 'rgba(255,255,255,0.72)',
                padding: '9px 14px',
                color: '#374151',
                fontSize: '12px',
                fontWeight: 700,
                boxShadow: '0 10px 20px rgba(15, 23, 42, 0.08)',
                backdropFilter: 'blur(12px)',
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={14} />
              뒤로
            </button>
          )}
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '28px',
            background: 'rgba(255,255,255,0.78)',
            boxShadow: '0 24px 48px rgba(15, 23, 42, 0.12)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div
            ref={contentRef}
            onScroll={handleContentScroll}
            style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 22px' }}
          >
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.16em', color: '#059669', marginBottom: '10px' }}>MEASUREMENT AXES</div>
              <h1 style={{ fontSize: '27px', lineHeight: 1.34, fontWeight: 850, color: '#111827', marginBottom: '12px', wordBreak: 'keep-all', letterSpacing: '-0.045em' }}>
                49문항은 아래 4개 축을 기준으로
                <br />
                나의 mebody 코드를 계산합니다
              </h1>
              <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#4b5563', wordBreak: 'keep-all' }}>
                정답을 맞히는 방식이 아니라, 지금 몸이 더 가깝게 느끼는 방향을 선택해주면 됩니다.
              </p>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              {AXIS_ITEMS.map((item) => (
                <div
                  key={item.title}
                  style={{
                    borderRadius: '18px',
                    border: `1px solid ${item.border}`,
                    background: item.surface,
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '16px',
                        background: 'rgba(255,255,255,0.94)',
                        overflow: 'hidden',
                        boxShadow: '0 8px 18px rgba(15, 23, 42, 0.06)',
                        flexShrink: 0,
                      }}
                    >
                      <img src={item.icon} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>{item.title}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            borderRadius: '999px',
                            background: 'rgba(255,255,255,0.94)',
                            color: item.accent,
                            padding: '7px 12px',
                            fontSize: '13px',
                            fontWeight: 700,
                          }}
                        >
                          {item.left}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: AXIS_GREEN_THEME.textSoft }}>vs</span>
                        <span
                          style={{
                            borderRadius: '999px',
                            background: 'rgba(255,255,255,0.94)',
                            color: item.accent,
                            padding: '7px 12px',
                            fontSize: '13px',
                            fontWeight: 700,
                          }}
                        >
                          {item.right}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: '16px',
                borderRadius: '18px',
                border: `1px solid ${AXIS_GREEN_THEME.border}`,
                background: 'rgba(228,244,240,0.82)',
                padding: '18px',
              }}
            >
              <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#466e65', textAlign: 'center', wordBreak: 'keep-all' }}>
                같은 자세를 오래 유지할수록 보상 패턴이 더 선명하게 드러납니다.
                <br />
                지금 몸이 자주 쓰는 방향을 떠올리며 답해주세요.
              </p>
            </div>

            <div ref={bottomRef} style={{ height: '14px' }} />
          </div>

          <div
            style={{
              padding: '14px 24px 22px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.94) 42%, rgba(255,255,255,0.98) 100%)',
              boxShadow: '0 -18px 28px rgba(255,255,255,0.88)',
              backdropFilter: 'blur(14px)',
            }}
          >
            <button
              type="button"
              onClick={canBegin ? onBegin : undefined}
              disabled={!canBegin}
              aria-disabled={!canBegin}
              style={{
                display: 'inline-flex',
                width: '100%',
                height: '58px',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: '18px',
                border: 'none',
                background: canBegin
                  ? 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)'
                  : 'linear-gradient(90deg, #e5e7eb 0%, #d1d5db 100%)',
                color: canBegin ? '#ffffff' : '#94a3b8',
                fontSize: '16px',
                fontWeight: 800,
                boxShadow: canBegin ? '0 14px 28px rgba(20,184,166,0.25)' : 'none',
                cursor: canBegin ? 'pointer' : 'not-allowed',
                transition: 'background 180ms ease, color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
              }}
            >
              내 체형 코드 분석 시작하기
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
                아래 4축 안내를 끝까지 보면 시작할 수 있어요
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
