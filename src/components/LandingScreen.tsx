import { ChevronRight, Sparkles, UserRound } from 'lucide-react';

interface LandingScreenProps {
  onStart: () => void;
  onQuickResult?: () => void;
  hasQuickResult?: boolean;
  isLoggedIn?: boolean;
  userEmail?: string;
  onAccount?: () => void;
  onMembership?: () => void;
}

export function LandingScreen({
  onStart,
  onQuickResult,
  hasQuickResult = false,
  isLoggedIn = false,
  userEmail,
  onAccount,
  onMembership,
}: LandingScreenProps) {
  const showQuickResult = hasQuickResult && !!onQuickResult;
  const mainCtaLabel = showQuickResult ? '지난 결과 바로 보기' : '진단 시작하기';
  const mainCtaAction = showQuickResult ? onQuickResult : onStart;
  const accountActionLabel = isLoggedIn ? '멤버십/결제' : '회원가입/로그인';
  const accountAction = isLoggedIn ? onMembership : onAccount;

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        height: '844px',
        borderRadius: '32px',
        background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 50%, #ecfeff 100%)',
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.13)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: '80px',
            left: '-80px',
            width: '384px',
            height: '384px',
            borderRadius: '999px',
            background: 'rgba(52, 211, 153, 0.20)',
            filter: 'blur(64px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '80px',
            right: '-80px',
            width: '384px',
            height: '384px',
            borderRadius: '999px',
            background: 'rgba(45, 212, 191, 0.20)',
            filter: 'blur(64px)',
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
              border: '1px solid rgba(255,255,255,0.28)',
              background: 'rgba(255,255,255,0.62)',
              padding: '8px 16px',
              boxShadow: '0 10px 20px rgba(15, 23, 42, 0.10)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Sparkles size={18} color="#059669" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>MEBODY</span>
          </div>

          {onAccount && (
            <button
              type="button"
              onClick={onAccount}
              style={{
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.28)',
                background: 'rgba(255,255,255,0.62)',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#374151',
                boxShadow: '0 10px 20px rgba(15, 23, 42, 0.10)',
                backdropFilter: 'blur(12px)',
                cursor: 'pointer',
              }}
            >
              {isLoggedIn ? '내 계정' : '로그인'}
            </button>
          )}
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            borderRadius: '24px',
            background: 'rgba(255,255,255,0.74)',
            boxShadow: '0 20px 46px rgba(15, 23, 42, 0.12)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div style={{ display: 'flex', height: '100%', flexDirection: 'column', padding: '24px' }}>
            <div style={{ marginBottom: '22px', textAlign: 'center' }}>
              <div
                style={{
                  position: 'relative',
                  margin: '0 auto 18px',
                  width: '96px',
                  height: '96px',
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, #34d399 0%, #14b8a6 100%)',
                  boxShadow: '0 12px 26px rgba(16,185,129,0.33)',
                }}
              >
                <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={42} color="#ffffff" strokeWidth={2.5} />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: -1,
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, #34d399 0%, #14b8a6 100%)',
                    opacity: 0.5,
                    filter: 'blur(16px)',
                  }}
                />
              </div>

              <h1
                style={{
                  marginBottom: '18px',
                  fontSize: '48px',
                  lineHeight: 1,
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
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
                  marginBottom: '10px',
                  fontSize: '18px',
                  lineHeight: 1.36,
                  fontWeight: 700,
                  color: '#1f2937',
                  wordBreak: 'keep-all',
                }}
              >
                내의 바디 코드를
                <br />
                발견하세요
              </h2>
              <p style={{ fontSize: '14px', lineHeight: 1.45, color: '#4b5563', wordBreak: 'keep-all' }}>
                자세한 균형을 위한 간단한 셀프체크
              </p>
            </div>

            <button
              type="button"
              onClick={mainCtaAction}
              style={{
                display: 'inline-flex',
                width: '100%',
                height: '60px',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: '16px',
                border: 'none',
                background: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)',
                color: '#ffffff',
                fontSize: '17px',
                fontWeight: 700,
                boxShadow: '0 12px 26px rgba(20,184,166,0.35)',
                cursor: 'pointer',
              }}
            >
              <span>{mainCtaLabel}</span>
              <ChevronRight size={20} />
            </button>

            {showQuickResult && (
              <button
                type="button"
                onClick={onStart}
                style={{
                  marginTop: '10px',
                  alignSelf: 'center',
                  border: 'none',
                  background: 'transparent',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#6b7280',
                  cursor: 'pointer',
                }}
              >
                진단 시작하기
              </button>
            )}

            <div
              style={{
                marginTop: '18px',
                borderRadius: '16px',
                border: '1px solid rgba(229,231,235,0.9)',
                background: 'linear-gradient(135deg, rgba(249,250,251,0.88) 0%, rgba(243,244,246,0.88) 100%)',
                padding: '18px',
              }}
            >
              <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserRound size={16} color="#059669" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#374151' }}>ACCOUNT</h3>
              </div>
              <p style={{ marginBottom: '14px', fontSize: '12px', lineHeight: 1.55, color: '#4b5563', wordBreak: 'keep-all' }}>
                {isLoggedIn
                  ? `로그인됨: ${userEmail ?? '회원'}`
                  : '결과 저장/불러오기 자동 결과/메일알림 기능을 쓰려면 회원가입이 필요합니다.'}
              </p>
              {accountAction && (
                <button
                  type="button"
                  onClick={accountAction}
                  style={{
                    display: 'inline-flex',
                    width: '100%',
                    height: '46px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    borderRadius: '12px',
                    border: '1px solid rgba(110,231,183,0.95)',
                    background: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#374151',
                    cursor: 'pointer',
                  }}
                >
                  <ChevronRight size={16} />
                  {accountActionLabel}
                </button>
              )}
            </div>

            <div style={{ marginTop: '12px', display: 'grid', gap: '10px' }}>
              {['40문항', '16체질', '맞춤 가이드'].map((item) => (
                <button
                  key={item}
                  type="button"
                  style={{
                    height: '44px',
                    width: '100%',
                    borderRadius: '12px',
                    border: '1px solid rgba(229,231,235,0.95)',
                    background: 'rgba(255,255,255,0.78)',
                    padding: '0 16px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#374151',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center' }}>
                    <span>{item}</span>
                  </div>
                </button>
              ))}
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
