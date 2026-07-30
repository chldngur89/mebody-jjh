import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, CheckCircle2, Lock, LogOut, Mail, Sparkles, UserRound } from 'lucide-react';
import { requestPasswordReset, signInWithEmail, signOutAccount, signUpWithEmail, upsertProfileFromUser } from '../api/account';
import { useMediaQuery } from '../utils/useMediaQuery';
import { ScrollIndicator } from './ScrollIndicator';

interface AuthScreenProps {
  user: User | null;
  initialMode?: 'signin' | 'signup';
  onBack?: () => void;
  onSignedIn?: (user: User) => void | Promise<void>;
  onGoMembership?: () => void;
}

export function AuthScreen({ user, initialMode = 'signin', onBack, onSignedIn, onGoMembership }: AuthScreenProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)');
  const screenHeight = isDesktopMockup ? '100%' : '100dvh';

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(initialMode);
    setError(null);
    setMessage(null);
  }, [initialMode]);

  const completeSignedIn = async (signedInUser: User, displayNameForSignup?: string) => {
    await upsertProfileFromUser(signedInUser, displayNameForSignup);
    await onSignedIn?.(signedInUser);
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    if (mode === 'signup') {
      if (!passwordConfirm.trim()) {
        setError('비밀번호 확인을 입력해주세요.');
        return;
      }

      if (password !== passwordConfirm) {
        setError('비밀번호가 서로 일치하지 않습니다.');
        return;
      }
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === 'signup') {
        const trimmedEmail = email.trim();
        const trimmedDisplayName = displayName.trim() || undefined;
        let data: Awaited<ReturnType<typeof signUpWithEmail>>;

        try {
          data = await signUpWithEmail(trimmedEmail, password, trimmedDisplayName);
        } catch (signUpError) {
          try {
            const signInData = await signInWithEmail(trimmedEmail, password);
            if (signInData.user) {
              await completeSignedIn(signInData.user, trimmedDisplayName);
              setMessage('이미 가입된 계정으로 로그인되었습니다.');
              return;
            }
          } catch {
            throw signUpError;
          }
          throw signUpError;
        }

        if (data.session && data.user) {
          await completeSignedIn(data.user, trimmedDisplayName);
          setMessage('회원가입과 로그인이 완료되었습니다.');
          return;
        }

        try {
          const signInData = await signInWithEmail(trimmedEmail, password);
          if (signInData.user) {
            await completeSignedIn(signInData.user, trimmedDisplayName);
            setMessage('회원가입 후 로그인되었습니다.');
            return;
          }
        } catch {
          setMessage('회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.');
          return;
        }

        setMessage('회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.');
      } else {
        const data = await signInWithEmail(email.trim(), password);
        if (data.user) {
          await completeSignedIn(data.user);
        }
        setMessage('로그인되었습니다.');
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

  const handlePasswordReset = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('비밀번호를 재설정할 이메일을 먼저 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await requestPasswordReset(trimmedEmail);
      setMessage('비밀번호 재설정 메일을 보냈습니다. 메일함에서 링크를 확인해주세요.');
    } catch (err) {
      setError((err as Error)?.message ?? '비밀번호 재설정 메일 발송에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        height: isDesktopMockup ? '100%' : undefined,
        minHeight: screenHeight,
        borderRadius: isDesktopMockup ? '32px' : 0,
        background: 'linear-gradient(145deg, #ecfdf5 0%, #f3fdfb 42%, #f0fdfa 100%)',
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.13)',
        display: 'flex',
        flexDirection: 'column',
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
          height: screenHeight,
          minHeight: screenHeight,
          flexDirection: 'column',
          padding: '22px 24px 18px',
          fontFamily: '"SUIT Variable","Pretendard Variable","Noto Sans KR",sans-serif',
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
              border: '1px solid rgba(255,255,255,0.28)',
              background: 'rgba(255,255,255,0.62)',
              padding: '8px 16px',
              boxShadow: '0 10px 20px rgba(15, 23, 42, 0.10)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Sparkles size={18} color="#014725" />
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
          ref={scrollRef}
          style={{
            flex: '0 1 auto',
            maxHeight: 'calc(100% - 88px)',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            borderRadius: '24px',
            background: 'rgba(255,255,255,0.74)',
            boxShadow: '0 20px 46px rgba(15, 23, 42, 0.12)',
            backdropFilter: 'blur(20px)',
            padding: '22px',
            paddingBottom: 'calc(22px + env(safe-area-inset-bottom))',
          }}
        >
          <div style={{ margin: 'auto 0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', color: '#014725', marginBottom: '6px' }}>{user ? 'ACCOUNT' : '회원가입하고 결과 저장하기'}</div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, lineHeight: 1.2, color: '#1f2937' }}>로그인 / 회원가입</h1>
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
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', color: '#014725', marginBottom: '6px' }}>NEXT STEP</div>
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
                      background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
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
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', color: '#014725', marginBottom: '6px' }}>WELCOME</div>
                <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#374151', wordBreak: 'keep-all' }}>
                  로그인하면 결과가 계정에 연결되어, 다음 방문에서 바로 결과를 확인할 수 있습니다.
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
                  onClick={() => {
                    setMode('signin');
                    setPasswordConfirm('');
                    setError(null);
                    setMessage(null);
                  }}
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
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                    setMessage(null);
                  }}
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
                      onFocus={(e) => {
                        setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                      }}
                      placeholder="you@example.com"
                      autoComplete="email"
                      style={{
                        width: '100%',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontSize: '16px',
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
                      onFocus={(e) => {
                        setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                      }}
                      placeholder="8자 이상 권장"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      style={{
                        width: '100%',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontSize: '16px',
                        color: '#111827',
                      }}
                    />
                  </div>
                </label>

                {mode === 'signup' && (
                  <label style={{ display: 'block' }}>
                    <span style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>비밀번호 확인</span>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '0 12px',
                        height: '46px',
                        border: passwordConfirm && password !== passwordConfirm ? '1px solid rgba(248,113,113,0.9)' : '1px solid rgba(209,213,219,1)',
                        borderRadius: '12px',
                        background: passwordConfirm && password !== passwordConfirm ? 'rgba(254,242,242,0.95)' : 'rgba(249,250,251,0.98)',
                      }}
                    >
                      <Lock size={16} color={passwordConfirm && password !== passwordConfirm ? '#ef4444' : '#6b7280'} />
                      <input
                        type="password"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        onFocus={(e) => {
                          setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                        }}
                        placeholder="비밀번호를 다시 입력"
                        autoComplete="new-password"
                        style={{
                          width: '100%',
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          fontSize: '16px',
                          color: '#111827',
                        }}
                      />
                    </div>
                    {passwordConfirm && password !== passwordConfirm && (
                      <span style={{ display: 'block', marginTop: '6px', fontSize: '12px', lineHeight: 1.45, color: '#dc2626' }}>
                        입력한 비밀번호가 서로 다릅니다.
                      </span>
                    )}
                  </label>
                )}

                {mode === 'signup' && (
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
                        onFocus={(e) => {
                          setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                        }}
                        placeholder="표시 이름"
                        autoComplete="name"
                        style={{
                          width: '100%',
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          fontSize: '16px',
                          color: '#111827',
                        }}
                      />
                    </div>
                  </label>
                )}

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
                    background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
                    color: '#ffffff',
                    fontSize: '16px',
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    boxShadow: '0 10px 22px rgba(1,71,37,0.30)',
                  }}
                >
                  {loading ? '처리 중...' : mode === 'signup' ? '회원가입하고 시작' : '로그인'}
                </button>

                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={loading}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#014725',
                      fontSize: '12px',
                      fontWeight: 800,
                      textDecoration: 'underline',
                      textUnderlineOffset: '3px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.55 : 1,
                    }}
                  >
                    비밀번호를 잊으셨나요?
                  </button>
                )}

                {mode === 'signup' && (
                  <p style={{ fontSize: '12px', lineHeight: 1.5, color: '#6b7280', wordBreak: 'keep-all' }}>
                    회원가입이 완료되면 바로 로그인 상태로 다음 단계에 연결됩니다.
                  </p>
                )}
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
        <div style={{ height: 0, marginBottom: 'auto', flexShrink: 0 }} />
        <ScrollIndicator containerRef={scrollRef} bottomOffset="30px" />
      </div>
    </div>
  );
}
