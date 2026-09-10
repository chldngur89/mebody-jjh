import { useEffect, useRef, useState } from 'react';
import { BRAND_PAGE_BG } from '../theme/brand';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, CheckCircle2, Lock, LogOut, Mail, Smartphone, Sparkles, UserRound } from 'lucide-react';
import { requestPasswordReset, signOutAccount, upsertProfileFromUser } from '../api/account';
import { signInWithApproval, signUpWithIdentifier } from '../api/signup';
import { detectKind, formatPhone, resolveLoginEmail, type IdentifierKind } from '../lib/identifier';
import { preferredScrollBehavior } from '../lib/viewport';
import { CTA, PRODUCT } from '../theme/copy';
import { useMediaQuery } from '../utils/useMediaQuery';
import { ScrollIndicator } from './ScrollIndicator';

interface AuthScreenProps {
  user: User | null;
  initialMode?: 'signin' | 'signup';
  onBack?: () => void;
  onSignedIn?: (user: User) => void | Promise<void>;
  onGoMembership?: () => void;
}

/** Supabase 가 돌려주는 영어 오류를 화면에 쓸 문장으로 바꿉니다. */
function translateAuthError(err: unknown, kind: IdentifierKind): string {
  const raw = String((err as Error)?.message ?? '');
  const text = raw.toLowerCase();
  const label = kind === 'phone' ? '휴대폰 번호' : '이메일';

  if (text.includes('invalid login credentials')) return `${label} 또는 비밀번호가 올바르지 않습니다.`;
  if (text.includes('email not confirmed')) return '가입 확인이 아직 끝나지 않았습니다. 확인 메일의 링크를 열어주세요.';
  if (text.includes('already registered') || text.includes('already been registered')) {
    return '이미 가입된 계정입니다. 로그인으로 진행해주세요.';
  }
  // 길이 제한은 서버 설정이 정합니다. Supabase 가 자기 정책으로 거절하면 그 길이를 그대로 보여줍니다.
  const tooShort = raw.match(/at least (\d+) characters/i);
  if (tooShort) return `비밀번호는 ${tooShort[1]}자 이상으로 입력해주세요.`;
  return raw || '인증 처리 중 오류가 발생했습니다.';
}

export function AuthScreen({ user, initialMode = 'signin', onBack, onSignedIn, onGoMembership }: AuthScreenProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)');
  const screenHeight = isDesktopMockup ? '100%' : 'var(--mebody-app-height)';

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  /** 입력값으로 자동 판별(이메일/휴대폰). 토글 UI는 없습니다. */
  const [identifierKind, setIdentifierKind] = useState<IdentifierKind>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const passwordMismatch =
    mode === 'signup' && passwordConfirm.length > 0 && password !== passwordConfirm;

  useEffect(() => {
    setMode(initialMode);
    setError(null);
    setMessage(null);
    setPasswordConfirm('');
  }, [initialMode]);

  const completeSignedIn = async (signedInUser: User, displayNameForSignup?: string) => {
    await upsertProfileFromUser(signedInUser, displayNameForSignup);
    await onSignedIn?.(signedInUser);
  };

  const handleSubmit = async () => {
    const resolved = resolveLoginEmail(email, identifierKind);
    if ('error' in resolved) {
      setError(resolved.error);
      return;
    }
    if (!password) {
      setError('비밀번호를 입력해주세요.');
      return;
    }
    if (mode === 'signup') {
      if (!passwordConfirm) {
        setError('비밀번호 확인을 입력해주세요.');
        return;
      }
      if (password !== passwordConfirm) {
        setError('비밀번호가 일치하지 않습니다.');
        return;
      }
    }

    // 가입 조건은 여기까지입니다. 값이 있으면 그대로 진행합니다.
    // 길이 같은 제한은 서버 설정(mebody.auth.min-password-length)이 정하고, 지금은 1자입니다.

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === 'signup') {
        const trimmedDisplayName = displayName.trim() || undefined;
        const result = await signUpWithIdentifier(email, identifierKind, password, trimmedDisplayName);

        // 확인 절차를 켜 두었으면 여기서 멈춥니다(서버 설정 mebody.auth.*).
        if (result.verificationRequired) {
          setMessage(result.verificationHint ?? '가입 확인을 마친 뒤 로그인해주세요.');
          return;
        }

        const signInData = await signInWithApproval(email, identifierKind, password);
        if (signInData.user) {
          await completeSignedIn(signInData.user, trimmedDisplayName);
          setMessage(result.alreadyRegistered
            ? '이미 가입된 계정으로 로그인되었습니다.'
            : '회원가입과 로그인이 완료되었습니다.');
          return;
        }

        setMessage('회원가입이 완료되었습니다. 로그인해주세요.');
      } else {
        const data = await signInWithApproval(email, identifierKind, password);
        if (data.user) {
          await completeSignedIn(data.user);
        }
        setMessage('로그인되었습니다.');
      }
    } catch (err) {
      setError(translateAuthError(err, identifierKind));
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
    if (identifierKind === 'phone') {
      // 별칭 이메일은 실제로 받을 수 있는 주소가 아니라 재설정 메일이 갈 곳이 없습니다.
      setError('휴대폰으로 가입한 계정은 아직 비밀번호 재설정을 지원하지 않습니다.');
      return;
    }

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
        background: BRAND_PAGE_BG,
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
            background: 'rgba(0, 70, 40, 0.035)',
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
            background: 'rgba(0, 70, 40, 0.03)',
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
          paddingTop: 'calc(22px + env(safe-area-inset-top))',
          paddingBottom: 'calc(18px + env(safe-area-inset-bottom))',
          overflowY: 'auto',
          boxSizing: 'border-box',
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
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>{PRODUCT.mark}</span>
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
                    setPasswordConfirm('');
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
                  <span style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                    이메일 혹은 핸드폰 번호 넣어주세요
                  </span>
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
                    {identifierKind === 'phone'
                      ? <Smartphone size={16} color="#6b7280" />
                      : <Mail size={16} color="#6b7280" />}
                    <input
                      type={identifierKind === 'phone' ? 'tel' : 'email'}
                      inputMode={identifierKind === 'phone' ? 'numeric' : 'email'}
                      value={email}
                      onChange={(e) => {
                        const next = e.target.value;
                        setEmail(next);
                        // 입력 내용으로 이메일/휴대폰을 자동 판별합니다.
                        const detected = detectKind(next);
                        if (detected && detected !== identifierKind) setIdentifierKind(detected);
                      }}
                      onBlur={() => {
                        if (identifierKind === 'phone') setEmail((prev) => formatPhone(prev));
                      }}
                      onFocus={(e) => {
                        setTimeout(() => e.target.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'center' }), 300);
                      }}
                      placeholder="email@example.com 또는 010-1234-5678"
                      autoComplete={identifierKind === 'phone' ? 'tel' : 'email'}
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
                  <span style={{ display: 'block', marginTop: '6px', fontSize: '12px', lineHeight: 1.5, color: '#6b7280' }}>
                    {mode === 'signup'
                      ? '확인 절차 없이 바로 가입됩니다. 다음에도 같은 이메일 또는 번호로 로그인해주세요.'
                      : '가입할 때 쓴 이메일이나 번호를 그대로 입력해주세요.'}
                  </span>
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
                        setTimeout(() => e.target.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'center' }), 300);
                      }}
                      placeholder="원하는 비밀번호"
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
                    <span style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                      비밀번호 확인
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '0 12px',
                        height: '46px',
                        border: passwordMismatch ? '1px solid #dc2626' : '1px solid rgba(209,213,219,1)',
                        borderRadius: '12px',
                        background: 'rgba(249,250,251,0.98)',
                      }}
                    >
                      <Lock size={16} color={passwordMismatch ? '#dc2626' : '#6b7280'} />
                      <input
                        type="password"
                        value={passwordConfirm}
                        onChange={(e) => {
                          setPasswordConfirm(e.target.value);
                          if (error === '비밀번호가 일치하지 않습니다.') setError(null);
                        }}
                        onFocus={(e) => {
                          setTimeout(() => e.target.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'center' }), 300);
                        }}
                        placeholder="비밀번호를 한 번 더 입력"
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
                    {passwordMismatch && (
                      <span style={{ display: 'block', marginTop: '6px', fontSize: '12px', lineHeight: 1.45, color: '#dc2626', fontWeight: 700 }}>
                        비밀번호가 일치하지 않습니다.
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
                          setTimeout(() => e.target.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'center' }), 300);
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
                  disabled={loading || passwordMismatch}
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
                    cursor: loading || passwordMismatch ? 'not-allowed' : 'pointer',
                    opacity: loading || passwordMismatch ? 0.6 : 1,
                    boxShadow: '0 10px 22px rgba(1,71,37,0.30)',
                  }}
                >
                  {loading ? '처리 중...' : mode === 'signup' ? CTA.authSignup : CTA.authLogin}
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
