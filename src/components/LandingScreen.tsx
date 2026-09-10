import { ChevronRight, Clock3, LayoutDashboard, Sparkles, UserRound } from 'lucide-react';
import { BRAND_PAGE_BG } from '../theme/brand';
import { useRef } from 'react';
import { useMediaQuery } from '../utils/useMediaQuery';
import { ScrollIndicator } from './ScrollIndicator';

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
  /** 공유 링크(?ref=share&code=FRRS)로 들어온 경우의 친구 코드. 소셜 문구에만 씁니다. */
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
  userEmail,
  userDisplayName,
  latestBodyCode,
  onAccount,
  onPreviewSignedIn,
  sharedCode,
}: LandingScreenProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)');
  const scrollRef = useRef<HTMLDivElement>(null);
  // 로그인 상태에서 "분석 시작하기" 와 "지난 결과 보기" 가 사실상 같은 곳으로 가서
  // 버튼이 두 개 보이면 혼란스럽다. 코드가 있으면 주 버튼 하나로 합친다.
  // 다만 중간 진행이 있으면 이어서/처음부터 선택이 우선이다.
  const unifiedForMember = isLoggedIn && hasExistingCode && !hasIncompleteProgress;
  const showQuickResult = !unifiedForMember && isLoggedIn && hasQuickResult && !!onQuickResult;
  const canChooseIncomplete = hasIncompleteProgress && !!onResumeIncomplete && !!onStartFresh;
  const memberName = (userDisplayName?.trim() || userEmail?.split('@')[0]?.trim() || '회원').replace(/\s*회원님$/, '');
  const memberGreeting = `${memberName} 회원님`;
  const normalizedBodyCode = latestBodyCode?.trim().toUpperCase();
  const accountTitle = isLoggedIn ? memberGreeting : 'ACCOUNT';
  const accountLabel = isLoggedIn ? '내 페이지' : '로그인';
  const accountDescription = isLoggedIn
    ? hasQuickResult
      ? normalizedBodyCode
        ? `최근 mebody 코드 ${normalizedBodyCode}가 저장되어 있습니다. 내 페이지에서 코드 플랜과 오늘의 미션을 이어서 확인하세요.`
        : '최근 mebody 결과가 저장되어 있습니다. 내 페이지에서 코드 플랜과 오늘의 미션을 이어서 확인하세요.'
      : normalizedBodyCode
        ? `저장된 mebody 코드 ${normalizedBodyCode}가 있습니다. 내 페이지에서 현재 상태를 확인하세요.`
        : '재접속 반갑습니다. 첫 진단을 완료하면 mebody 코드와 코드 플랜이 내 페이지에 저장됩니다.'
    : '회원가입하면 결과 저장, 지난 결과 확인, 코드 플랜과 오늘의 미션을 다음 방문에서도 이어서 볼 수 있습니다.';
  const accountActionLabel = isLoggedIn ? '내 페이지' : '회원가입 / 로그인';
  const landingHeight = isDesktopMockup ? '100%' : 'var(--mebody-app-height)';

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        height: isDesktopMockup ? '100%' : undefined,
        minHeight: landingHeight,
        borderRadius: isDesktopMockup ? '32px' : 0,
        background: BRAND_PAGE_BG,
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.13)',
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
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          height: landingHeight,
          minHeight: landingHeight,
          flexDirection: 'column',
          padding: '22px 24px 20px',
          overflowY: 'auto',
        }}
      >
        <div style={{ marginTop: 'auto', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
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
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937' }}>MEBODY</span>
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
            flex: '0 0 auto',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '28px',
            background: 'rgba(255,255,255,0.78)',
            boxShadow: '0 24px 48px rgba(15, 23, 42, 0.12)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', padding: '30px 26px 24px' }}>
            <div style={{ marginBottom: '30px', textAlign: 'center' }}>
              <div
                style={{
                  position: 'relative',
                  margin: '0 auto 26px',
                  width: '94px',
                  height: '94px',
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, #016B38 0%, #014725 100%)',
                  boxShadow: '0 14px 30px rgba(1,71,37,0.34)',
                }}
              >
                <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={40} color="#ffffff" strokeWidth={2.6} />
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
                  marginBottom: '26px',
                  fontSize: '52px',
                  lineHeight: 0.96,
                  fontWeight: 800,
                  letterSpacing: '-0.04em',
                  background: 'linear-gradient(90deg, #014725 0%, #014725 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                mebody
              </h1>

              {sharedCode && (
                <p
                  style={{
                    margin: '-14px 0 20px',
                    padding: '10px 14px',
                    borderRadius: '999px',
                    background: '#EEF4EC',
                    color: '#014725',
                    fontSize: '13px',
                    fontWeight: 700,
                    lineHeight: 1.5,
                    wordBreak: 'keep-all',
                  }}
                >
                  친구의 몸BTI는 <strong style={{ fontWeight: 800 }}>{sharedCode}</strong> 였어요. 나는 어떤 유형일까요?
                </p>
              )}

              <h2
                style={{
                  marginBottom: '20px',
                  fontSize: '18px',
                  lineHeight: 1.5,
                  fontWeight: 800,
                  color: '#1f2937',
                  wordBreak: 'keep-all',
                }}
              >
                나의 몸Bti를
                <br />
                찾아보세요
              </h2>
              <p
                style={{
                  fontSize: '14px',
                  lineHeight: 1.7,
                  color: '#4b5563',
                  wordBreak: 'keep-all',
                }}
              >
                Mebody Check로 개인화 웰니스 가이드를 받아보세요
              </p>
            </div>

            <div style={{ display: 'grid', gap: '14px' }}>
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
                    }}
                  >
                    이전에 하던 분석이 있어요. 이어서 할까요, 처음부터 다시 할까요?
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.55, color: '#047857', wordBreak: 'keep-all' }}>
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
                  }}
                >
                  <span>
                    {unifiedForMember
                      ? '내 코드 · 오늘의 관리 이어서 하기'
                      : hasExistingCode
                        ? '내 체형 코드 결과 보기'
                        : '내 체형 코드 분석 시작하기'}
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

              <div
                style={{
                  borderRadius: '18px',
                  border: '1px solid rgba(229,231,235,0.92)',
                  background: 'linear-gradient(135deg, rgba(249,250,251,0.92) 0%, rgba(243,244,246,0.88) 100%)',
                  padding: '18px',
                }}
              >
                <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserRound size={16} color="#014725" />
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#374151' }}>{accountTitle}</h3>
                </div>
                <p style={{ marginBottom: '14px', fontSize: '12px', lineHeight: 1.6, color: '#4b5563', wordBreak: 'keep-all' }}>{accountDescription}</p>
                {isLoggedIn && normalizedBodyCode && (
                  <div
                    style={{
                      marginBottom: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
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
                      marginTop: '10px',
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
            </div>
          </div>
        </div>

        <p style={{ marginTop: '12px', marginBottom: 'auto', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
          Powered by Mebody • Designed for Mebody
        </p>
      </div>
      <ScrollIndicator containerRef={scrollRef} bottomOffset="30px" />
    </div>
  );
}
