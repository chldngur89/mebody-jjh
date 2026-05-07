import { ChevronRight, Clock3, LayoutDashboard, Sparkles, UserRound } from 'lucide-react';
import { useRef } from 'react';
import { useMediaQuery } from '../utils/useMediaQuery';
import { ScrollIndicator } from './ScrollIndicator';

interface LandingScreenProps {
  onStart: () => void;
  onQuickResult?: () => void;
  hasQuickResult?: boolean;
  isLoggedIn?: boolean;
  userEmail?: string;
  userDisplayName?: string;
  latestBodyCode?: string;
  onAccount?: () => void;
  onPreviewSignedIn?: () => void;
}

export function LandingScreen({
  onStart,
  onQuickResult,
  hasQuickResult = false,
  isLoggedIn = false,
  userEmail,
  userDisplayName,
  latestBodyCode,
  onAccount,
  onPreviewSignedIn,
}: LandingScreenProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)');
  const scrollRef = useRef<HTMLDivElement>(null);
  const showQuickResult = isLoggedIn && hasQuickResult && !!onQuickResult;
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

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: '100dvh',
        borderRadius: isDesktopMockup ? '32px' : 0,
        background: 'linear-gradient(145deg, #ecfdf5 0%, #f3fdfb 42%, #f0fdfa 100%)',
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
            background: 'rgba(52, 211, 153, 0.18)',
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
            background: 'rgba(45, 212, 191, 0.16)',
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
          height: '100%',
          flexDirection: 'column',
          padding: '22px 24px 18px',
          fontFamily: '"SUIT Variable","Pretendard Variable","Noto Sans KR",sans-serif',
          overflowY: 'auto',
        }}
      >
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
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
          <div style={{ margin: 'auto 0', display: 'flex', flexDirection: 'column', padding: '30px 26px 24px' }}>
            <div style={{ marginBottom: '30px', textAlign: 'center' }}>
              <div
                style={{
                  position: 'relative',
                  margin: '0 auto 26px',
                  width: '94px',
                  height: '94px',
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
                  boxShadow: '0 14px 30px rgba(16,185,129,0.34)',
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
                    background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
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
                  background: 'linear-gradient(90deg, #059669 0%, #0d9488 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                mebody
              </h1>

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
                나의 바디 코드를
                <br />
                발견하세요
              </h2>
              <p
                style={{
                  fontSize: '14px',
                  lineHeight: 1.7,
                  color: '#4b5563',
                  wordBreak: 'keep-all',
                }}
              >
                자세와 균형을 위한 셀프 체크
              </p>
            </div>

            <div style={{ display: 'grid', gap: '14px' }}>
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
                  background: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)',
                  color: '#ffffff',
                  fontSize: '17px',
                  fontWeight: 800,
                  boxShadow: '0 14px 28px rgba(20,184,166,0.30)',
                  cursor: 'pointer',
                }}
              >
                <span>내 체형 코드 분석 시작하기</span>
                <ChevronRight size={20} />
              </button>

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
                  <UserRound size={16} color="#059669" />
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
                {!isLoggedIn && onPreviewSignedIn && (
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
                      color: '#0f766e',
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

        <p style={{ marginTop: '12px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
          Powered by Mebody • Designed for Mebody
        </p>
      </div>
      <ScrollIndicator containerRef={scrollRef} bottomOffset="30px" />
    </div>
  );
}
