import { ChevronRight, Clock3, LayoutDashboard, Sparkles, UserRound } from 'lucide-react';

interface LandingScreenProps {
  onStart: () => void;
  onQuickResult?: () => void;
  hasQuickResult?: boolean;
  isLoggedIn?: boolean;
  userEmail?: string;
  onAccount?: () => void;
  onPreviewSignedIn?: () => void;
}

export function LandingScreen({
  onStart,
  onQuickResult,
  hasQuickResult = false,
  isLoggedIn = false,
  userEmail,
  onAccount,
  onPreviewSignedIn,
}: LandingScreenProps) {
  const showQuickResult = isLoggedIn && hasQuickResult && !!onQuickResult;
  const accountLabel = isLoggedIn ? '내 페이지' : '로그인';
  const accountDescription = isLoggedIn
    ? `${userEmail ?? '회원'} 계정에 결과 저장과 코드 플랜 연결이 준비되어 있습니다.`
    : '결과 저장, 지난 결과 다시 보기, 결제/메일 알림 연결을 쓰려면 회원가입/로그인이 필요합니다.';
  const accountActionLabel = isLoggedIn ? '내 페이지 열기' : '회원가입/로그인';

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
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          height: '100%',
          flexDirection: 'column',
          padding: '22px 24px 18px',
          fontFamily: '"SUIT Variable","Pretendard Variable","Noto Sans KR",sans-serif',
        }}
      >
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            overflow: 'hidden',
            borderRadius: '28px',
            background: 'rgba(255,255,255,0.78)',
            boxShadow: '0 24px 48px rgba(15, 23, 42, 0.12)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div style={{ display: 'flex', height: '100%', flexDirection: 'column', padding: '30px 26px 24px' }}>
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

            <div style={{ marginTop: 'auto', display: 'grid', gap: '14px' }}>
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
                  지난 결과 바로 보기 &gt;
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
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#374151' }}>ACCOUNT</h3>
                </div>
                <p style={{ marginBottom: '14px', fontSize: '12px', lineHeight: 1.6, color: '#4b5563', wordBreak: 'keep-all' }}>{accountDescription}</p>
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
    </div>
  );
}
