import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, CheckCircle2, Crown, ShieldCheck } from 'lucide-react';
import { fetchMembershipPlans, fetchMySubscription, type MembershipPlan, type UserSubscription } from '../api/account';

interface MembershipScreenProps {
  user: User | null;
  onBack?: () => void;
  onRequireAuth?: () => void;
  onSelectPlan?: (planCode: string) => void;
}

function formatKrw(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value);
}

function billingLabel(cycle: MembershipPlan['billing_cycle']): string {
  if (cycle === 'yearly') return '연';
  if (cycle === 'one_time') return '1회';
  return '월';
}

export function MembershipScreen({ user, onBack, onRequireAuth, onSelectPlan }: MembershipScreenProps) {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [mySubscription, setMySubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchMembershipPlans(),
      user ? fetchMySubscription(user.id) : Promise.resolve(null),
    ])
      .then(([planList, subscription]) => {
        if (cancelled) return;
        setPlans(planList);
        setMySubscription(subscription);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const planMap = useMemo(() => {
    const map: Record<string, MembershipPlan> = {};
    for (const plan of plans) {
      map[plan.code] = plan;
    }
    return map;
  }, [plans]);

  const currentPlan = mySubscription ? planMap[mySubscription.plan_code] : null;

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
            <div className="text-[10px] font-semibold tracking-[0.18em] text-emerald-600 mb-0.5">MEMBERSHIP</div>
            <h1 className="text-[19px] font-bold text-gray-900 tracking-tight truncate">멤버십 / 결제</h1>
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
                결과 자동 저장, 재방문 바로 보기, 멤버십 구독을 사용하려면 먼저 회원가입/로그인을 진행해주세요.
              </p>
              {onRequireAuth && (
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="mt-4 w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-xl font-semibold"
                >
                  회원가입 / 로그인
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 shadow-sm">
                <div className="text-[11px] font-semibold tracking-[0.12em] text-emerald-700 mb-1">ACCOUNT</div>
                <p className="text-sm text-emerald-900 break-all">{user.email}</p>
                {mySubscription ? (
                  <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-white/80 border border-emerald-200 px-3 py-1.5 rounded-full">
                    <CheckCircle2 className="w-4 h-4" />
                    활성 구독: {currentPlan?.name ?? mySubscription.plan_code}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-emerald-800">현재 활성 구독이 없습니다.</p>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  멤버십 혜택
                </div>
                <ul className="text-sm text-gray-700 leading-7 space-y-1 [word-break:keep-all]">
                  <li>• 결과 히스토리와 재방문 자동 결과 진입</li>
                  <li>• 체형별 심화 리포트와 맞춤 루틴 우선 제공</li>
                  <li>• 이후 리포트 비교 기능 확장 시 우선 적용</li>
                </ul>
              </div>

              {loading ? (
                <div className="text-sm text-gray-500">요금제를 불러오는 중...</div>
              ) : (
                <div className="space-y-3">
                  {plans.map((plan) => {
                    const isCurrent = mySubscription?.plan_code === plan.code && (mySubscription.status === 'active' || mySubscription.status === 'trialing');
                    const isRecommended = plan.code === 'pro_monthly' && !isCurrent;
                    return (
                      <section
                        key={plan.code}
                        className={`rounded-2xl border p-5 transition-all ${
                          isCurrent
                            ? 'bg-emerald-50 border-emerald-200 shadow-sm'
                            : isRecommended
                              ? 'bg-gradient-to-br from-white to-emerald-50/55 border-emerald-300 shadow-md shadow-emerald-200/40'
                              : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            {isRecommended && (
                              <span className="inline-flex text-[11px] font-semibold tracking-[0.1em] text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full mb-2">
                                RECOMMENDED
                              </span>
                            )}
                            <h3 className="text-base font-bold text-gray-900">{plan.name}</h3>
                            <p className="text-sm text-gray-600 mt-1 [word-break:keep-all]">{plan.description}</p>
                          </div>
                          <Crown className={`w-5 h-5 ${isCurrent ? 'text-emerald-600' : 'text-gray-400'}`} />
                        </div>
                        <div className="text-lg font-black text-gray-900 mb-3">
                          ₩{formatKrw(plan.price_krw)}
                          <span className="text-sm font-medium text-gray-500"> / {billingLabel(plan.billing_cycle)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectPlan?.(plan.code)}
                          className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                            isCurrent
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : isRecommended
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/25'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {isCurrent ? '현재 이용 중' : '이 요금제로 진행'}
                        </button>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
