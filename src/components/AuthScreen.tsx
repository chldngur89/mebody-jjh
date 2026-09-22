import { useEffect, useRef, useState } from 'react';
import { BRAND_PAGE_BG } from '../theme/brand';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, CheckCircle2, Lock, LogOut, Mail, Smartphone, UserRound } from 'lucide-react';
import { requestPasswordReset, signOutAccount, upsertProfileFromUser } from '../api/account';
import { requestPhonePasswordReset, signInByPhone, signInWithApproval, signUpWithIdentifier } from '../api/signup';
import { detectKind, formatPhone, resolveLoginEmail, type IdentifierKind } from '../lib/identifier';
import { authErrorMessage } from '../lib/authErrorMessage';
import { preferredScrollBehavior } from '../lib/viewport';
import { CTA, PRODUCT } from '../theme/copy';
import { BrandMark, ConsentCheckbox, LegalConsentLabel } from './ui';
import { useMediaQuery } from '../utils/useMediaQuery';
import { ScrollIndicator } from './ScrollIndicator';

interface AuthScreenProps {
  user: User | null;
  initialMode?: 'signin' | 'signup';
  /** save-result: 휴대폰으로 결과 보관에 맞춘 안내 */
  purpose?: 'default' | 'save-result';
  onBack?: () => void;
  onSignedIn?: (user: User) => void | Promise<void>;
  onGoMembership?: () => void;
}

/** 화면에는 우리 문장만 나갑니다. 영어 원문은 콘솔에만 남습니다 — lib/authErrorMessage.ts */
function translateAuthError(err: unknown, kind: IdentifierKind): string {
  return authErrorMessage(err, '인증 처리 중 오류가 발생했습니다.', kind === 'phone' ? '휴대폰 번호' : '이메일');
}

export function AuthScreen({ user, initialMode = 'signin', purpose = 'default', onBack, onSignedIn, onGoMembership }: AuthScreenProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)');
  const screenHeight = isDesktopMockup ? '100%' : 'var(--mebody-app-height)';

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  /** 입력값으로 자동 판별(이메일/휴대폰). 토글 UI는 없습니다. */
  const [identifierKind, setIdentifierKind] = useState<IdentifierKind>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  /** 휴대폰 가입에서만 쓰는 복구용 이메일. 비우면 지금까지와 똑같이 가입됩니다. */
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 회원가입은 두 동의를 모두 받기 전에는 제출할 수 없습니다. */
  const [agreeService, setAgreeService] = useState(false);
  const [agreeLegal, setAgreeLegal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const passwordMismatch =
    mode === 'signup' && passwordConfirm.length > 0 && password !== passwordConfirm;
  /** 회원가입에서만 동의가 필요합니다. 로그인은 이미 동의한 계정입니다. */
  const consentPending = mode === 'signup' && !(agreeService && agreeLegal);
  const submitBlocked = loading || passwordMismatch || consentPending;

  useEffect(() => {
    setMode(purpose === 'save-result' ? 'signup' : initialMode);
    setError(null);
    setMessage(null);
    setPasswordConfirm('');
    if (purpose === 'save-result') setIdentifierKind('phone');
  }, [initialMode, purpose]);

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
      if (!agreeService || !agreeLegal) {
        setError('아래 두 가지 동의에 모두 체크해주세요.');
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
        const result = await signUpWithIdentifier(
          email, identifierKind, password, trimmedDisplayName,
          identifierKind === 'phone' ? recoveryEmail : undefined,
          // 체크박스 두 개가 약관과 처리방침을 함께 묶고 있습니다. 둘 다 눌러야 여기까지 옵니다.
          { terms: agreeLegal, privacy: agreeLegal, marketing: false },
        );

        // 확인 절차를 켜 두었으면 여기서 멈춥니다(서버 설정 mebody.auth.*).
        //
        // 메일을 열고 돌아온 사람이 가입 화면에 그대로 남아 있으면 "가입이 된 건가" 싶어
        // 같은 정보로 또 가입을 누릅니다. 그래서 로그인 화면으로 옮겨 두고 아이디만 남깁니다.
        // 비밀번호와 동의 체크는 비웁니다 — 로그인에는 동의가 필요 없습니다.
        if (result.verificationRequired) {
          setMode('signin');
          setPassword('');
          setPasswordConfirm('');
          setAgreeService(false);
          setAgreeLegal(false);
          setMessage(result.verificationHint ?? '가입 확인을 마친 뒤 로그인해주세요.');
          return;
        }

        const signInData = identifierKind === 'phone'
          ? await signInByPhone(email, password)
          : await signInWithApproval(email, identifierKind, password);
        if (signInData.user) {
          await completeSignedIn(signInData.user, trimmedDisplayName);
          setMessage(result.alreadyRegistered
            ? '이미 가입된 계정으로 로그인되었습니다.'
            : '회원가입과 로그인이 완료되었습니다.');
          return;
        }

        setMessage('회원가입이 완료되었습니다. 로그인해주세요.');
      } else {
        const data = identifierKind === 'phone'
          ? await signInByPhone(email, password)
          : await signInWithApproval(email, identifierKind, password);
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
      setError(authErrorMessage(err, '로그아웃 중 오류가 발생했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (identifierKind === 'phone') {
      // 가입할 때 복구용 이메일을 적었다면 그 주소로 갑니다. 안 적었으면 보낼 곳이 없습니다.
      // 어느 쪽이든 같은 안내를 보여줍니다. 응답이 갈리면 번호만으로 가입 여부를 알 수 있습니다.
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        await requestPhonePasswordReset(email);
        setMessage('가입할 때 복구용 이메일을 적으셨다면 그 주소로 재설정 메일을 보냈습니다.');
      } catch (err) {
        setError((err as Error)?.message ?? '재설정 요청에 실패했습니다.');
      } finally {
        setLoading(false);
      }
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
      setError(authErrorMessage(err, '비밀번호 재설정 메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.'));
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
        boxShadow: '0 24px 60px var(--mebody-d-k13, rgba(1, 71, 37, 0.13))',
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
            background: 'var(--mebody-s-k04, rgba(0, 70, 40, 0.035))',
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
            background: 'var(--mebody-s-k03, rgba(0, 70, 40, 0.03))',
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
              border: '1px solid var(--mebody-b-w28, rgba(255,255,255,0.28))',
              background: 'var(--mebody-s-w62, rgba(255,255,255,0.62))',
              padding: '8px 16px',
              boxShadow: '0 10px 20px var(--mebody-d-k10, rgba(1, 71, 37, 0.10))',
              backdropFilter: 'blur(12px)',
            }}
          >
            <BrandMark size={16} color="#014725" />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--mebody-t-014725, #014725)' }}>{PRODUCT.mark}</span>
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
                border: '1px solid var(--mebody-b-w28, rgba(255,255,255,0.28))',
                background: 'var(--mebody-s-w62, rgba(255,255,255,0.62))',
                minHeight: '44px',
                padding: '8px 14px',
                color: 'var(--mebody-t-2c5544, #2C5544)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                boxShadow: '0 10px 20px var(--mebody-d-k10, rgba(1, 71, 37, 0.10))',
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
            background: 'var(--mebody-s-w74, rgba(255,255,255,0.74))',
            boxShadow: '0 20px 46px var(--mebody-d-k12, rgba(1, 71, 37, 0.12))',
            backdropFilter: 'blur(20px)',
            padding: '22px',
            paddingBottom: 'calc(22px + env(safe-area-inset-bottom))',
          }}
        >
          <div style={{ margin: 'auto 0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--mebody-t-014725, #014725)', marginBottom: '6px' }}>
              {user
                ? '계정'
                : purpose === 'save-result'
                  ? '휴대폰으로 결과 보관'
                  : '결과 저장을 위해 가입하기'}
            </div>
            <h1 style={{ fontSize: '1.625rem', fontWeight: 800, lineHeight: 1.2, color: 'var(--mebody-t-014725, #014725)' }}>
              {purpose === 'save-result' && !user ? '번호만으로 빠르게 저장' : '로그인 / 회원가입'}
            </h1>
            {purpose === 'save-result' && !user && (
              <p style={{ margin: '10px 0 0', fontSize: '0.875rem', lineHeight: 1.55, color: 'var(--mebody-t-3d6b54, #3D6B54)', wordBreak: 'keep-all' }}>
                010 번호를 입력하면 결과만 계정에 연결해요. 이메일 없이도 다음에 다시 볼 수 있습니다.
              </p>
            )}
          </div>

          {user ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              <div
                style={{
                  borderRadius: '16px',
                  border: '1px solid var(--mebody-b-g100, rgba(167, 243, 208, 1))',
                  background: 'var(--mebody-s-w95, rgba(236, 253, 245, 0.95))',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--mebody-t-047857, #047857)', fontSize: '0.875rem', fontWeight: 700, marginBottom: '8px' }}>
                  <CheckCircle2 size={16} />
                  로그인 상태
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--mebody-t-064e3b, #064e3b)', wordBreak: 'break-all' }}>{user.email}</p>
              </div>

              <div
                style={{
                  borderRadius: '16px',
                  border: '1px solid var(--mebody-b-w90, rgba(225, 233, 218,0.9))',
                  background: 'linear-gradient(135deg, var(--mebody-s-w88, rgba(247, 250, 244,0.88)) 0%, var(--mebody-s-w88-2, rgba(240, 244, 236,0.88)) 100%)',
                  padding: '16px',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--mebody-t-014725, #014725)', marginBottom: '6px' }}>NEXT STEP</div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--mebody-t-014725, #014725)', marginBottom: '8px' }}>재방문 자동 결과 / 멤버십 연결</h2>
                <p style={{ fontSize: '0.875rem', lineHeight: 1.65, color: 'var(--mebody-t-2c5544, #2C5544)', wordBreak: 'keep-all' }}>
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
                      background: 'linear-gradient(90deg, var(--mebody-s-016b38, #016B38) 0%, var(--mebody-s-014725, #014725) 100%)',
                      color: 'var(--mebody-t-ffffff-2, #ffffff)',
                      fontSize: '0.9375rem',
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
                  border: '1px solid var(--mebody-b-g100-2, rgba(200, 214, 196,1))',
                  background: 'var(--mebody-s-w84, rgba(255,255,255,0.84))',
                  color: 'var(--mebody-t-2c5544, #2C5544)',
                  fontSize: '0.875rem',
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
                  border: '1px solid var(--mebody-b-w90, rgba(225, 233, 218,0.9))',
                  background: 'linear-gradient(135deg, var(--mebody-s-w88, rgba(247, 250, 244,0.88)) 0%, var(--mebody-s-w88-2, rgba(240, 244, 236,0.88)) 100%)',
                  padding: '16px',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--mebody-t-014725, #014725)', marginBottom: '6px' }}>WELCOME</div>
                <p style={{ fontSize: '0.875rem', lineHeight: 1.65, color: 'var(--mebody-t-2c5544, #2C5544)', wordBreak: 'keep-all' }}>
                  로그인하면 결과가 계정에 연결되어, 다음 방문에서 바로 결과를 확인할 수 있습니다.
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  borderRadius: '12px',
                  background: 'var(--mebody-s-w92, rgba(240, 244, 236,0.92))',
                  padding: '4px',
                  border: '1px solid var(--mebody-b-w95, rgba(225, 233, 218,0.95))',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setPasswordConfirm('');
                    setAgreeService(false);
                    setAgreeLegal(false);
                    setError(null);
                    setMessage(null);
                  }}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    borderRadius: '10px',
                    border: 'none',
                    background: mode === 'signin' ? 'var(--mebody-s-ffffff, #ffffff)' : 'transparent',
                    color: mode === 'signin' ? 'var(--mebody-t-014725, #014725)' : 'var(--mebody-t-4a6b58, #4A6B58)',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    boxShadow: mode === 'signin' ? '0 4px 10px var(--mebody-d-k08, rgba(1, 71, 37, 0.08))' : 'none',
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
                    setAgreeService(false);
                    setAgreeLegal(false);
                    setError(null);
                    setMessage(null);
                  }}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    borderRadius: '10px',
                    border: 'none',
                    background: mode === 'signup' ? 'var(--mebody-s-ffffff, #ffffff)' : 'transparent',
                    color: mode === 'signup' ? 'var(--mebody-t-014725, #014725)' : 'var(--mebody-t-4a6b58, #4A6B58)',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    boxShadow: mode === 'signup' ? '0 4px 10px var(--mebody-d-k08, rgba(1, 71, 37, 0.08))' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  회원가입
                </button>
              </div>

              <form
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSubmit();
                }}
                style={{
                  display: 'grid',
                  gap: '10px',
                  borderRadius: '16px',
                  border: '1px solid var(--mebody-b-w90, rgba(225, 233, 218,0.9))',
                  background: 'var(--mebody-s-w86, rgba(255,255,255,0.86))',
                  padding: '16px',
                }}
              >
                <label style={{ display: 'block' }}>
                  <span style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--mebody-t-2c5544, #2C5544)' }}>
                    이메일 혹은 핸드폰 번호 넣어주세요
                  </span>
                  <div
                    className="mebody-field"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '0 12px',
                      height: '46px',
                      border: '1px solid var(--mebody-b-g100-2, rgba(200, 214, 196,1))',
                      borderRadius: '12px',
                      background: 'var(--mebody-s-w98, rgba(247, 250, 244,0.98))',
                    }}
                  >
                    {identifierKind === 'phone'
                      ? <Smartphone size={16} color="#4A6B58" />
                      : <Mail size={16} color="#4A6B58" />}
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
                      required
                      style={{
                        width: '100%',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontSize: '1rem',
                        color: 'var(--mebody-t-014725, #014725)',
                      }}
                    />
                  </div>
                  <span style={{ display: 'block', marginTop: '6px', fontSize: '0.8125rem', lineHeight: 1.5, color: 'var(--mebody-t-4a6b58, #4A6B58)' }}>
                    {mode === 'signup'
                      ? '확인 절차 없이 바로 가입됩니다. 다음에도 같은 이메일 또는 번호로 로그인해주세요.'
                      : '가입할 때 쓴 이메일이나 번호를 그대로 입력해주세요.'}
                  </span>
                </label>

                <label style={{ display: 'block' }}>
                  <span style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--mebody-t-2c5544, #2C5544)' }}>비밀번호</span>
                  <div
                    className="mebody-field"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '0 12px',
                      height: '46px',
                      border: '1px solid var(--mebody-b-g100-2, rgba(200, 214, 196,1))',
                      borderRadius: '12px',
                      background: 'var(--mebody-s-w98, rgba(247, 250, 244,0.98))',
                    }}
                  >
                    <Lock size={16} color="#4A6B58" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={(e) => {
                        setTimeout(() => e.target.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'center' }), 300);
                      }}
                      placeholder="원하는 비밀번호"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      required
                      style={{
                        width: '100%',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontSize: '1rem',
                        color: 'var(--mebody-t-014725, #014725)',
                      }}
                    />
                  </div>
                </label>

                {mode === 'signup' && (
                  <label style={{ display: 'block' }}>
                    <span style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--mebody-t-2c5544, #2C5544)' }}>
                      비밀번호 확인
                    </span>
                    <div
                      className="mebody-field"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '0 12px',
                        height: '46px',
                        border: passwordMismatch ? '1px solid var(--mebody-b-8e3a32, #8E3A32)' : '1px solid var(--mebody-b-g100-2, rgba(200, 214, 196,1))',
                        borderRadius: '12px',
                        background: 'var(--mebody-s-w98, rgba(247, 250, 244,0.98))',
                      }}
                    >
                      <Lock size={16} color={passwordMismatch ? '#8E3A32' : '#4A6B58'} />
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
                        required
                        style={{
                          width: '100%',
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          fontSize: '1rem',
                          color: 'var(--mebody-t-014725, #014725)',
                        }}
                      />
                    </div>
                    {passwordMismatch && (
                      <span style={{ display: 'block', marginTop: '6px', fontSize: '0.8125rem', lineHeight: 1.45, color: 'var(--mebody-t-8e3a32, #8E3A32)', fontWeight: 700 }}>
                        비밀번호가 일치하지 않습니다.
                      </span>
                    )}
                  </label>
                )}

                {mode === 'signup' && identifierKind === 'phone' && (
                  <label style={{ display: 'block' }}>
                    <span style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--mebody-t-2c5544, #2C5544)' }}>
                      복구용 이메일(선택)
                    </span>
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px', height: '46px',
                        border: '1px solid rgba(209,213,219,1)', borderRadius: '12px', background: 'rgba(249,250,251,0.98)',
                      }}
                    >
                      <Mail size={16} color="#6b7280" />
                      <input
                        type="email"
                        inputMode="email"
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        style={{
                          width: '100%', border: 'none', outline: 'none', background: 'transparent',
                          fontSize: '16px', color: '#111827',
                        }}
                      />
                    </div>
                    <span style={{ display: 'block', marginTop: '6px', fontSize: '12px', lineHeight: 1.5, color: '#6b7280', wordBreak: 'keep-all' }}>
                      비밀번호를 잊었을 때 여기로 재설정 메일을 보냅니다. 비워두면 번호로만 로그인할 수 있고 재설정은 안 됩니다.
                    </span>
                  </label>
                )}

                {mode === 'signup' && (
                  <label style={{ display: 'block' }}>
                    <span style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--mebody-t-2c5544, #2C5544)' }}>이름(선택)</span>
                    <div
                      className="mebody-field"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '0 12px',
                        height: '46px',
                        border: '1px solid var(--mebody-b-g100-2, rgba(200, 214, 196,1))',
                        borderRadius: '12px',
                        background: 'var(--mebody-s-w98, rgba(247, 250, 244,0.98))',
                      }}
                    >
                      <UserRound size={16} color="#4A6B58" />
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
                          fontSize: '1rem',
                          color: 'var(--mebody-t-014725, #014725)',
                        }}
                      />
                    </div>
                  </label>
                )}

                {mode === 'signup' && (
                  <div style={{ display: 'grid', gap: '8px', marginTop: '2px' }}>
                    <ConsentCheckbox checked={agreeService} onChange={setAgreeService}>
                      {PRODUCT.codeName}는 의료 진단이 아닌 웰니스 셀프 체크임을 이해했습니다.
                    </ConsentCheckbox>
                    <ConsentCheckbox checked={agreeLegal} onChange={setAgreeLegal}>
                      <LegalConsentLabel />
                    </ConsentCheckbox>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitBlocked}
                  style={{
                    display: 'inline-flex',
                    width: '100%',
                    height: '52px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(90deg, var(--mebody-s-016b38, #016B38) 0%, var(--mebody-s-014725, #014725) 100%)',
                    color: 'var(--mebody-t-ffffff-2, #ffffff)',
                    fontSize: '1rem',
                    fontWeight: 700,
                    cursor: submitBlocked ? 'not-allowed' : 'pointer',
                    opacity: submitBlocked ? 0.6 : 1,
                    boxShadow: '0 10px 22px var(--mebody-d-k30, rgba(1,71,37,0.30))',
                  }}
                >
                  {loading ? '처리 중...' : mode === 'signup' ? CTA.authSignup : CTA.authLogin}
                </button>
                {consentPending && (
                  <p style={{ margin: 0, fontSize: '0.8125rem', lineHeight: 1.5, color: 'var(--mebody-t-4a6b58, #4A6B58)' }}>
                    위 두 가지에 동의하면 가입할 수 있습니다.
                  </p>
                )}

                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={loading}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--mebody-t-014725, #014725)',
                      fontSize: '0.8125rem',
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
                  <p style={{ fontSize: '0.8125rem', lineHeight: 1.5, color: 'var(--mebody-t-4a6b58, #4A6B58)', wordBreak: 'keep-all' }}>
                    회원가입이 완료되면 바로 로그인 상태로 다음 단계에 연결됩니다.
                  </p>
                )}
              </form>
            </div>
          )}

          {message && (
            <div
              role="status"
              aria-live="polite"
              style={{
                marginTop: '14px',
                borderRadius: '12px',
                border: '1px solid var(--mebody-b-g100, rgba(167, 243, 208, 1))',
                background: 'var(--mebody-s-w95, rgba(236, 253, 245, 0.95))',
                color: 'var(--mebody-t-047857, #047857)',
                fontSize: '0.8125rem',
                padding: '12px 14px',
              }}
            >
              {message}
            </div>
          )}
          {error && (
            <div
              role="alert"
              style={{
                marginTop: '14px',
                borderRadius: '12px',
                border: '1px solid var(--mebody-b-w100, rgba(254, 205, 211, 1))',
                background: 'var(--mebody-s-w95-2, rgba(254, 242, 242, 0.95))',
                color: 'var(--mebody-t-8e3a32, #8E3A32)',
                fontSize: '0.8125rem',
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
