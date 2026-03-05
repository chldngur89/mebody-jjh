import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, CheckCircle2, Lock, LogOut, Mail, UserRound } from 'lucide-react';
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
    <div className="bg-gradient-to-b from-gray-50 to-white rounded-3xl shadow-xl overflow-hidden" style={{ height: '844px' }}>
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 bg-white/85 backdrop-blur-lg border-b border-gray-100 px-6 py-4 flex items-center gap-3 z-10">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </button>
          )}
          <div className="min-w-0">
            <div className="text-[10px] font-semibold tracking-[0.18em] text-emerald-600 mb-0.5">ACCOUNT</div>
            <h1 className="text-[19px] font-bold text-gray-900 tracking-tight truncate">회원가입 / 로그인</h1>
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto px-6 py-6"
          style={{ fontFamily: '"SUIT Variable","Pretendard Variable","Noto Sans KR",sans-serif' }}
        >
          {user ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="inline-flex items-center gap-2 text-emerald-700 text-sm font-semibold mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  로그인 상태
                </div>
                <p className="text-sm text-emerald-900 break-all">{user.email}</p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="text-[11px] font-semibold tracking-[0.13em] text-emerald-600 mb-1">NEXT STEP</div>
                <h2 className="text-base font-bold text-gray-900 mb-2">재방문 자동 결과 / 멤버십 연결</h2>
                <p className="text-sm text-gray-700 leading-7 [word-break:keep-all]">
                  재방문 시 최근 결과로 바로 진입할 수 있고, 멤버십 결제를 통해 심화 리포트를 사용할 수 있습니다.
                </p>
                {onGoMembership && (
                  <button
                    type="button"
                    onClick={onGoMembership}
                    className="mt-4 w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-xl font-semibold shadow-md shadow-emerald-500/25"
                  >
                    멤버십/결제 페이지 이동
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={loading}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                로그아웃
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-semibold tracking-[0.13em] text-emerald-600 mb-1">WELCOME</div>
                <p className="text-sm text-gray-700 leading-7 [word-break:keep-all]">
                  회원가입 후 로그인하면 결과가 계정에 연결되어, 다음 방문에서 바로 결과를 확인할 수 있습니다.
                </p>
              </div>

              <div className="flex rounded-xl bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${mode === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
                >
                  회원가입
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${mode === 'signin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
                >
                  로그인
                </button>
              </div>

              <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700 mb-1.5 block">이메일</span>
                  <div className="flex items-center gap-2 px-3 py-3 border border-gray-300 rounded-xl bg-gray-50 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-transparent outline-none text-sm text-gray-900"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-gray-700 mb-1.5 block">비밀번호</span>
                  <div className="flex items-center gap-2 px-3 py-3 border border-gray-300 rounded-xl bg-gray-50 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
                    <Lock className="w-4 h-4 text-gray-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8자 이상 권장"
                      className="w-full bg-transparent outline-none text-sm text-gray-900"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-gray-700 mb-1.5 block">이름(선택)</span>
                  <div className="flex items-center gap-2 px-3 py-3 border border-gray-300 rounded-xl bg-gray-50 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
                    <UserRound className="w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="표시 이름"
                      className="w-full bg-transparent outline-none text-sm text-gray-900"
                    />
                  </div>
                </label>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-xl font-semibold shadow-md shadow-emerald-500/25 disabled:opacity-60"
                >
                  {loading ? '처리 중...' : mode === 'signup' ? '회원가입하고 시작' : '로그인'}
                </button>

                <p className="text-[12px] text-gray-500 leading-5 [word-break:keep-all]">
                  이메일 인증 설정이 켜져 있으면, 회원가입 후 메일 인증을 완료해야 로그인됩니다.
                </p>
              </div>
            </div>
          )}

          {message && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm px-4 py-3">
              {message}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 break-words">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
