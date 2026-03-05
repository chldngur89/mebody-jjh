import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, CheckCircle2, CreditCard } from 'lucide-react';
import { activateSubscription, fetchMembershipPlans, type MembershipPlan } from '../api/account';

interface CheckoutScreenProps {
  user: User | null;
  planCode: string;
  onBack?: () => void;
  onComplete?: () => void;
  onRequireAuth?: () => void;
}

function formatKrw(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value);
}

export function CheckoutScreen({ user, planCode, onBack, onComplete, onRequireAuth }: CheckoutScreenProps) {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingPlans(true);
    fetchMembershipPlans()
      .then((list) => {
        if (cancelled) return;
        setPlans(list);
      })
      .finally(() => {
        if (!cancelled) setLoadingPlans(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPlan = useMemo(() => plans.find((p) => p.code === planCode) ?? null, [plans, planCode]);

  const handleConfirm = async () => {
    if (!user) {
      onRequireAuth?.();
      return;
    }
    if (!selectedPlan) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await activateSubscription(user.id, selectedPlan.code);
      setSuccess('결제가 완료되었습니다. 멤버십이 활성화되었습니다.');
      onComplete?.();
    } catch (err) {
      setError((err as Error)?.message ?? '결제 처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
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
            <div className="text-[10px] font-semibold tracking-[0.18em] text-emerald-600 mb-0.5">CHECKOUT</div>
            <h1 className="text-[19px] font-bold text-gray-900 tracking-tight truncate">결제 진행</h1>
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto px-6 py-6"
          style={{ fontFamily: '"SUIT Variable","Pretendard Variable","Noto Sans KR",sans-serif' }}
        >
          {!user ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-2">로그인이 필요합니다</h2>
              <p className="text-sm text-gray-700 leading-7 [word-break:keep-all]">
                결제를 진행하려면 먼저 회원가입/로그인을 완료해주세요.
              </p>
              {onRequireAuth && (
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="mt-4 w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-xl font-semibold"
                >
                  로그인하러 가기
                </button>
              )}
            </div>
          ) : loadingPlans ? (
            <div className="text-sm text-gray-500">요금제 정보를 불러오는 중...</div>
          ) : !selectedPlan ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              선택한 요금제를 찾을 수 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 shadow-sm">
                <div className="text-[11px] font-semibold tracking-[0.12em] text-emerald-700 mb-1">ORDER SUMMARY</div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  선택 요금제
                </div>
                <h2 className="text-xl font-bold text-gray-900">{selectedPlan.name}</h2>
                <p className="text-sm text-gray-600 mt-1 [word-break:keep-all]">{selectedPlan.description}</p>
                <div className="mt-3 text-2xl font-black text-gray-900">
                  ₩{formatKrw(selectedPlan.price_krw)}
                  <span className="text-sm font-medium text-gray-500"> / 월</span>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-gray-900 mb-2">결제 안내</h3>
                <p className="text-sm text-gray-700 leading-7 [word-break:keep-all]">
                  현재는 MVP 테스트 모드 결제로, 버튼 클릭 시 DB에 활성 구독 상태를 생성합니다.
                  실제 카드 결제는 Toss/Stripe 연동 단계에서 추가하면 됩니다.
                </p>
                <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 leading-6 [word-break:keep-all]">
                  결제 완료 후: 멤버십이 즉시 활성화되고 재방문 시 자동 결과 진입과 심화 리포트 기능이 열립니다.
                </div>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="mt-4 w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-xl font-semibold shadow-md shadow-emerald-500/25 disabled:opacity-60"
                >
                  {submitting ? '결제 처리 중...' : '결제 완료(테스트)'}
                </button>
              </section>
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm px-4 py-3 inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {success}
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
