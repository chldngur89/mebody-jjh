import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, CheckCircle2, Lock, LogOut, Mail, Sparkles, UserRound } from 'lucide-react';
import { signInWithEmail, signOutAccount, signUpWithEmail, upsertProfileFromUser } from '../api/account';

interface AuthScreenProps {
  user: User | null;
  onBack?: () => void;
  onSignedIn?: () => void;
  onGoMembership?: () => void;
}

export function AuthScreen({ user, onBack, onSignedIn, onGoMembership }: AuthScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === 'signup') {
        const data = await signUpWithEmail(email.trim(), password, displayName.trim() || undefined);
        if (data.user) {
          await upsertProfileFromUser(data.user, displayName.trim() || undefined);
        }
        if (data.session) {
          setMessage('회원가입과 로그인이 완료되었습니다.');
          onSignedIn?.();
        } else {
          setMessage('회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.');
        }
      } else {
        const data = await signInWithEmail(email.trim(), password);
        if (data.user) {
          await upsertProfileFromUser(data.user, displayName.trim() || undefined);
        }
        setMessage('로그인되었습니다.');
        onSignedIn?.();
      }
    } catch (err) {
      setError((err as Error)?.message ?? '인증 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await signOutAccount();
      setMessage('로그아웃되었습니다.');
    } catch (err) {
      setError((err as Error)?.message ?? '로그아웃 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

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

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.28)',
                background: 'rgba(255,255,255,0.62)',
                padding: '8px 14px',
                color: '#374151',
                fontSize: '12px',
                fontWeight: 600,
                boxShadow: '0 10px 20px rgba(15, 23, 42, 0.10)',
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
            overflowY: 'auto',
            borderRadius: '24px',
            background: 'rgba(255,255,255,0.74)',
            boxShadow: '0 20px 46px rgba(15, 23, 42, 0.12)',
            backdropFilter: 'blur(20px)',
            padding: '22px',
          }}
        >
          <div style={{ marginBottom: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', color: '#059669', marginBottom: '6px' }}>ACCOUNT</div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, lineHeight: 1.2, color: '#1f2937' }}>회원가입 / 로그인</h1>
          </div>

          {user ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              <div
                style={{
                  borderRadius: '16px',
                  border: '1px solid rgba(167, 243, 208, 1)',
                  background: 'rgba(236, 253, 245, 0.95)',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#047857', fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>
                  <CheckCircle2 size={16} />
                  로그인 상태
                </div>
                <p style={{ fontSize: '14px', color: '#064e3b', wordBreak: 'break-all' }}>{user.email}</p>
              </div>

              <div
                style={{
                  borderRadius: '16px',
                  border: '1px solid rgba(229,231,235,0.9)',
                  background: 'linear-gradient(135deg, rgba(249,250,251,0.88) 0%, rgba(243,244,246,0.88) 100%)',
                  padding: '16px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', color: '#059669', marginBottom: '6px' }}>NEXT STEP</div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>재방문 자동 결과 / 멤버십 연결</h2>
                <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#374151', wordBreak: 'keep-all' }}>
                  재방문 시 최근 결과로 바로 진입할 수 있고, 멤버십 결제를 통해 심화 리포트를 사용할 수 있습니다.
                </p>
                {onGoMembership && (
                  <button
                    type="button"
                    onClick={onGoMembership}
                    style={{
                      marginTop: '14px',
                      display: 'inline-flex',
                      width: '100%',
                      height: '50px',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '12px',
                      border: 'none',
                      background: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)',
                      color: '#ffffff',
                      fontSize: '15px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    멤버십/결제 페이지 이동
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={loading}
                style={{
                  display: 'inline-flex',
                  width: '100%',
                  height: '46px',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: '12px',
                  border: '1px solid rgba(209,213,219,1)',
                  background: 'rgba(255,255,255,0.84)',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <LogOut size={16} />
                로그아웃
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              <div
                style={{
                  borderRadius: '16px',
                  border: '1px solid rgba(229,231,235,0.9)',
                  background: 'linear-gradient(135deg, rgba(249,250,251,0.88) 0%, rgba(243,244,246,0.88) 100%)',
                  padding: '16px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', color: '#059669', marginBottom: '6px' }}>WELCOME</div>
                <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#374151', wordBreak: 'keep-all' }}>
                  회원가입 후 로그인하면 결과가 계정에 연결되어, 다음 방문에서 바로 결과를 확인할 수 있습니다.
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  borderRadius: '12px',
                  background: 'rgba(243,244,246,0.92)',
                  padding: '4px',
                  border: '1px solid rgba(229,231,235,0.95)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  style={{
                    flex: 1,
                    height: '38px',
                    borderRadius: '10px',
                    border: 'none',
                    background: mode === 'signup' ? '#ffffff' : 'transparent',
                    color: mode === 'signup' ? '#111827' : '#6b7280',
                    fontSize: '14px',
                    fontWeight: 700,
                    boxShadow: mode === 'signup' ? '0 4px 10px rgba(15,23,42,0.08)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  회원가입
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  style={{
                    flex: 1,
                    height: '38px',
                    borderRadius: '10px',
                    border: 'none',
                    background: mode === 'signin' ? '#ffffff' : 'transparent',
                    color: mode === 'signin' ? '#111827' : '#6b7280',
                    fontSize: '14px',
                    fontWeight: 700,
                    boxShadow: mode === 'signin' ? '0 4px 10px rgba(15,23,42,0.08)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  로그인
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: '10px',
                  borderRadius: '16px',
                  border: '1px solid rgba(229,231,235,0.9)',
                  background: 'rgba(255,255,255,0.86)',
                  padding: '16px',
                }}
              >
                <label style={{ display: 'block' }}>
                  <span style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>이메일</span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '0 12px',
                      height: '46px',
                      border: '1px solid rgba(209,213,219,1)',
                      borderRadius: '12px',
                      background: 'rgba(249,250,251,0.98)',
                    }}
                  >
                    <Mail size={16} color="#6b7280" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      style={{
                        width: '100%',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontSize: '14px',
                        color: '#111827',
                      }}
                    />
                  </div>
                </label>

                <label style={{ display: 'block' }}>
                  <span style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>비밀번호</span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '0 12px',
                      height: '46px',
                      border: '1px solid rgba(209,213,219,1)',
                      borderRadius: '12px',
                      background: 'rgba(249,250,251,0.98)',
                    }}
                  >
                    <Lock size={16} color="#6b7280" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8자 이상 권장"
                      style={{
                        width: '100%',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontSize: '14px',
                        color: '#111827',
                      }}
                    />
                  </div>
                </label>

                <label style={{ display: 'block' }}>
                  <span style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>이름(선택)</span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '0 12px',
                      height: '46px',
                      border: '1px solid rgba(209,213,219,1)',
                      borderRadius: '12px',
                      background: 'rgba(249,250,251,0.98)',
                    }}
                  >
                    <UserRound size={16} color="#6b7280" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="표시 이름"
                      style={{
                        width: '100%',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontSize: '14px',
                        color: '#111827',
                      }}
                    />
                  </div>
                </label>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{
                    display: 'inline-flex',
                    width: '100%',
                    height: '52px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)',
                    color: '#ffffff',
                    fontSize: '16px',
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    boxShadow: '0 10px 22px rgba(20,184,166,0.30)',
                  }}
                >
                  {loading ? '처리 중...' : mode === 'signup' ? '회원가입하고 시작' : '로그인'}
                </button>

                <p style={{ fontSize: '12px', lineHeight: 1.5, color: '#6b7280', wordBreak: 'keep-all' }}>
                  이메일 인증 설정이 켜져 있으면, 회원가입 후 메일 인증을 완료해야 로그인됩니다.
                </p>
              </div>
            </div>
          )}

          {message && (
            <div
              style={{
                marginTop: '14px',
                borderRadius: '12px',
                border: '1px solid rgba(167, 243, 208, 1)',
                background: 'rgba(236, 253, 245, 0.95)',
                color: '#047857',
                fontSize: '13px',
                padding: '12px 14px',
              }}
            >
              {message}
            </div>
          )}
          {error && (
            <div
              style={{
                marginTop: '14px',
                borderRadius: '12px',
                border: '1px solid rgba(254, 205, 211, 1)',
                background: 'rgba(254, 242, 242, 0.95)',
                color: '#b91c1c',
                fontSize: '13px',
                padding: '12px 14px',
                wordBreak: 'break-word',
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
