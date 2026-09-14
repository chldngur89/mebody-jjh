import { ChevronRight, Clock3, LayoutDashboard, Sparkles } from 'lucide-react';
import { BRAND_PAGE_BG } from '../theme/brand';
import { CTA, PRODUCT } from '../theme/copy';
import { useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { preferredScrollBehavior } from '../lib/viewport';
import { useMediaQuery } from '../utils/useMediaQuery';
import { ScrollIndicator } from './ScrollIndicator';
import { SharePreviewCard } from './SharePreviewCard';

interface LandingScreenProps {
  onStart: () => void;
  /** 이미 코드가 있으면 문항을 건너뛰고 결과로 갑니다. 버튼 문구도 바뀝니다. */
  hasExistingCode?: boolean;
  /** 중간에 멈춘 설문이 있으면 이어서 / 처음부터를 고르게 합니다. */
  hasIncompleteProgress?: boolean;
  /** 중간 설문 이어서 하기 */
  onResumeIncomplete?: () => void;
  /** 중간 설문 버리고 약관(동의)부터 다시 시작 */
  onStartFresh?: () => void;
  onQuickResult?: () => void;
  hasQuickResult?: boolean;
  isLoggedIn?: boolean;
  userEmail?: string;
  userDisplayName?: string;
  latestBodyCode?: string;
  onAccount?: () => void;
  onPreviewSignedIn?: () => void;
  /** 공유 링크(?ref=share&code=FRRS) — 공개 미리보기 카드용. 개인 결과는 열지 않습니다. */
  sharedCode?: string;
}

export function LandingScreen({
  onStart,
  hasExistingCode = false,
  hasIncompleteProgress = false,
  onResumeIncomplete,
  onStartFresh,
  onQuickResult,
  hasQuickResult = false,
  isLoggedIn = false,
  latestBodyCode,
  onAccount,
  onPreviewSignedIn,
  sharedCode,
}: LandingScreenProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)');
  /** 짧은 뷰포트에서는 버튼을 위쪽에 두고 바깥 스크롤로 넘깁니다. */
  const isShortViewport = useMediaQuery('(max-height: 720px)');
  const scrollRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  // 로그인 상태에서 "분석 시작하기" 와 "지난 결과 보기" 가 사실상 같은 곳으로 가서
  // 버튼이 두 개 보이면 혼란스럽다. 코드가 있으면 주 버튼 하나로 합친다.
  // 다만 중간 진행이 있으면 이어서/처음부터 선택이 우선이다.
  const unifiedForMember = isLoggedIn && hasExistingCode && !hasIncompleteProgress;
  const showQuickResult = !unifiedForMember && isLoggedIn && hasQuickResult && !!onQuickResult;
  const canChooseIncomplete = hasIncompleteProgress && !!onResumeIncomplete && !!onStartFresh;
  const normalizedBodyCode = latestBodyCode?.trim().toUpperCase();
  const accountLabel = isLoggedIn ? '내 페이지' : '로그인';
  const accountActionLabel = isLoggedIn ? '내 페이지' : '회원가입 / 로그인';
  const landingHeight = isDesktopMockup ? '100%' : 'var(--mebody-app-height)';

  const scrollToCta = useCallback(() => {
    const container = scrollRef.current;
    const target = ctaRef.current;
    if (!container || !target) return;
    const cRect = container.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();
    // 이미 충분히 보이면 움직이지 않습니다.
    if (tRect.top >= cRect.top + 8 && tRect.bottom <= cRect.bottom - 8) return;
    const nextTop = container.scrollTop + (tRect.top - cRect.top) - 12;
    container.scrollTo({ top: Math.max(0, nextTop), behavior: preferredScrollBehavior() });
  }, []);

  const handleSurfaceClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;
    if (el.closest('button, a, input, textarea, select, [role="button"]')) return;
    scrollToCta();
  };

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        height: isDesktopMockup ? '100%' : undefined,
        minHeight: landingHeight,
        maxHeight: isDesktopMockup ? undefined : landingHeight,
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
            top: '54px',
            left: '-88px',
            width: '300px',
            height: '300px',
            borderRadius: '999px',
            background: 'rgba(0, 70, 40, 0.035)',
            filter: 'blur(58px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '72px',
            right: '-96px',
            width: '320px',
            height: '320px',
            borderRadius: '999px',
            background: 'rgba(0, 70, 40, 0.03)',
            filter: 'blur(72px)',
          }}
        />
      </div>

      <div
        ref={scrollRef}
        onClick={handleSurfaceClick}
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          height: landingHeight,
          minHeight: landingHeight,
          flexDirection: 'column',
          padding: isDesktopMockup ? '22px 24px 20px' : '12px 16px 16px',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          boxSizing: 'border-box',
          cursor: 'default',
        }}
      >
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
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
            <Sparkles size={18} color="#014725" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937' }}>{PRODUCT.mark}</span>
          </div>

          {onAccount && (
            <button
              type="button"
              onClick={onAccount}
              style={{
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.4)',
                background: 'rgba(255,255,255,0.72)',
                padding: '9px 16px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#374151',
                boxShadow: '0 10px 20px rgba(15, 23, 42, 0.08)',
                backdropFilter: 'blur(12px)',
                cursor: 'pointer',
              }}
            >
              {accountLabel}
            </button>
          )}
        </div>

        <div
          style={{
            flex: isShortViewport ? '0 0 auto' : '1 1 auto',
            minHeight: isShortViewport ? undefined : 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: isShortViewport ? 'visible' : 'hidden',
            borderRadius: '28px',
            background: 'rgba(255,255,255,0.78)',
            boxShadow: '0 24px 48px rgba(15, 23, 42, 0.12)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div
            style={{
              flex: isShortViewport ? undefined : 1,
              minHeight: isShortViewport ? undefined : 0,
              display: 'flex',
              flexDirection: 'column',
              padding: isShortViewport ? '22px 22px 20px' : '28px 26px 28px',
            }}
          >
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div
                style={{
                  position: 'relative',
                  margin: isShortViewport ? '0 auto 14px' : '0 auto 22px',
                  width: isShortViewport ? '72px' : '94px',
                  height: isShortViewport ? '72px' : '94px',
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, #016B38 0%, #014725 100%)',
                  boxShadow: '0 14px 30px rgba(1,71,37,0.34)',
                }}
              >
                <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={isShortViewport ? 30 : 40} color="#ffffff" strokeWidth={2.6} />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: -1,
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, #016B38 0%, #014725 100%)',
                    opacity: 0.55,
                    filter: 'blur(18px)',
                  }}
                />
              </div>

              <h1
                style={{
                  marginBottom: isShortViewport ? '12px' : '22px',
                  fontSize: isShortViewport ? '40px' : '52px',
                  lineHeight: 0.96,
                  fontWeight: 800,
                  letterSpacing: '-0.04em',
                  background: 'linear-gradient(90deg, #014725 0%, #014725 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {PRODUCT.mark}
              </h1>

              {sharedCode && (
                <div style={{ width: '100%', margin: '0 0 18px' }}>
                  <SharePreviewCard bodyCode={sharedCode} onStartDiagnosis={onStart} />
                </div>
              )}

              <h2
                style={{
                  marginBottom: '12px',
                  fontSize: '22px',
                  lineHeight: 1.35,
                  fontWeight: 850,
                  color: '#111827',
                  wordBreak: 'keep-all',
                  letterSpacing: '-0.03em',
                  textAlign: 'center',
                }}
              >
                {sharedCode ? (
                  <>
                    나는 어떤 {PRODUCT.codeName}일까요?
                  </>
                ) : (
                  <>
                    나의 {PRODUCT.codeName}를
                    <br />
                    찾아보세요
                  </>
                )}
              </h2>
              <p
                style={{
                  fontSize: '14px',
                  lineHeight: 1.7,
                  color: '#4b5563',
                  wordBreak: 'keep-all',
                  textAlign: 'center',
                }}
              >
                {PRODUCT.codeGuide} 확인 후,
                <br />
                나에게 맞는 개인화 웰니스 가이드를 받아보세요
              </p>
            </div>

            {/* 주 CTA — 짧은 화면에서는 위쪽, 빈 곳 클릭 시 여기로 스크롤 */}
            <div
              ref={ctaRef}
              style={{
                flex: isShortViewport ? '0 0 auto' : '1 1 auto',
                minHeight: isShortViewport ? undefined : '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: isShortViewport ? 'flex-start' : 'center',
                paddingTop: isShortViewport ? '10px' : 0,
              }}
            >
              <div style={{ width: '100%', display: 'grid', gap: '14px', justifyItems: 'stretch' }}>
                {canChooseIncomplete ? (
                  <div
                    style={{
                      display: 'grid',
                      gap: '12px',
                      borderRadius: '18px',
                      border: '1px solid rgba(167,243,208,0.95)',
                      background: 'rgba(236,253,245,0.72)',
                      padding: '16px',
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: '15px',
                        fontWeight: 800,
                        color: '#014725',
                        wordBreak: 'keep-all',
                        lineHeight: 1.5,
                        textAlign: 'center',
                      }}
                    >
                      이전에 하던 분석이 있어요.
                      <br />
                      이어서 할까요, 처음부터 다시 할까요?
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.55, color: '#047857', wordBreak: 'keep-all', textAlign: 'center' }}>
                      처음부터는 약관 동의 화면부터 다시 시작합니다.
                    </p>
                    <button
                      type="button"
                      onClick={onResumeIncomplete}
                      style={{
                        display: 'inline-flex',
                        width: '100%',
                        height: '54px',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        borderRadius: '16px',
                        border: 'none',
                        background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
                        color: '#ffffff',
                        fontSize: '16px',
                        fontWeight: 800,
                        boxShadow: '0 12px 24px rgba(1,71,37,0.28)',
                        cursor: 'pointer',
                      }}
                    >
                      이어서 할래요
                      <ChevronRight size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={onStartFresh}
                      style={{
                        display: 'inline-flex',
                        width: '100%',
                        height: '48px',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '14px',
                        border: '1px solid rgba(167,243,208,0.95)',
                        background: '#ffffff',
                        color: '#014725',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      처음부터 할래요
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onStart}
                    style={{
                      display: 'inline-flex',
                      width: '100%',
                      height: '62px',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      borderRadius: '18px',
                      border: 'none',
                      background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
                      color: '#ffffff',
                      fontSize: '17px',
                      fontWeight: 800,
                      boxShadow: '0 14px 28px rgba(1,71,37,0.30)',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <span style={{ textAlign: 'center' }}>
                      {unifiedForMember
                        ? '미션 이어하기'
                        : hasExistingCode
                          ? CTA.viewResult
                          : CTA.diagnosisStart}
                    </span>
                    <ChevronRight size={20} />
                  </button>
                )}

                {showQuickResult && (
                  <button
                    type="button"
                    onClick={onQuickResult}
                    style={{
                      display: 'inline-flex',
                      width: '100%',
                      height: '50px',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      borderRadius: '16px',
                      border: '1px solid rgba(167,243,208,0.92)',
                      background: 'rgba(236,253,245,0.88)',
                      color: '#047857',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Clock3 size={16} />
                    지난 결과 · 오늘의 미션 보기 &gt;
                  </button>
                )}
              </div>
            </div>

            {(onAccount || (import.meta.env.DEV && !isLoggedIn && onPreviewSignedIn)) && (
              <div
                style={{
                  display: 'grid',
                  gap: '12px',
                  flexShrink: 0,
                  justifyItems: 'center',
                }}
              >
                {isLoggedIn && normalizedBodyCode && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      justifySelf: 'start',
                      borderRadius: '999px',
                      background: 'rgba(236,253,245,0.95)',
                      border: '1px solid rgba(167,243,208,0.92)',
                      padding: '7px 11px',
                      color: '#047857',
                      fontSize: '12px',
                      fontWeight: 900,
                    }}
                  >
                    최근 코드
                    <span style={{ color: '#111827' }}>{normalizedBodyCode}</span>
                  </div>
                )}
                {onAccount && (
                  <button
                    type="button"
                    onClick={onAccount}
                    style={{
                      display: 'inline-flex',
                      width: '100%',
                      height: '50px',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      borderRadius: '14px',
                      border: '1px solid rgba(110,231,183,0.95)',
                      background: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#374151',
                      cursor: 'pointer',
                    }}
                  >
                    {isLoggedIn ? <LayoutDashboard size={16} /> : <ChevronRight size={16} />}
                    {accountActionLabel}
                  </button>
                )}
                {import.meta.env.DEV && !isLoggedIn && onPreviewSignedIn && (
                  <button
                    type="button"
                    onClick={onPreviewSignedIn}
                    style={{
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#014725',
                      textDecoration: 'underline',
                      textUnderlineOffset: '3px',
                      cursor: 'pointer',
                    }}
                  >
                    임시: 가입 후 화면 미리보기
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <p
          style={{
            marginTop: '14px',
            flexShrink: 0,
            textAlign: 'center',
            fontSize: '12px',
            color: '#6b7280',
          }}
        >
          Powered by Mebody • Designed for Mebody
        </p>
      </div>
      <ScrollIndicator containerRef={scrollRef} targetRef={ctaRef} bottomOffset="30px" />
    </div>
  );
}
