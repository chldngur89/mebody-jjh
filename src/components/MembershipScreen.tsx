import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, CheckCircle2, Crown, ShieldCheck, Sparkles } from 'lucide-react';
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
    const nextMap: Record<string, MembershipPlan> = {};
    for (const plan of plans) {
      nextMap[plan.code] = plan;
    }
    return nextMap;
  }, [plans]);

  const currentPlan = mySubscription ? planMap[mySubscription.plan_code] : null;

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
            top: '56px',
            left: '-84px',
            width: '300px',
            height: '300px',
            borderRadius: '999px',
            background: 'rgba(52, 211, 153, 0.16)',
            filter: 'blur(58px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            right: '-96px',
            width: '320px',
            height: '320px',
            borderRadius: '999px',
            background: 'rgba(45, 212, 191, 0.15)',
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
          padding: '22px 24px 20px',
          fontFamily: '"SUIT Variable","Pretendard Variable","Noto Sans KR",sans-serif',
        }}
      >
        <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.4)',
                background: 'rgba(255,255,255,0.72)',
                padding: '9px 14px',
                color: '#374151',
                fontSize: '12px',
                fontWeight: 700,
                boxShadow: '0 10px 20px rgba(15, 23, 42, 0.08)',
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
            borderRadius: '28px',
            background: 'rgba(255,255,255,0.78)',
            boxShadow: '0 24px 48px rgba(15, 23, 42, 0.12)',
            backdropFilter: 'blur(20px)',
            padding: '24px',
          }}
        >
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.16em', color: '#059669', marginBottom: '8px' }}>CODE PLAN</div>
            <h1 style={{ fontSize: '28px', lineHeight: 1.3, fontWeight: 800, color: '#111827', marginBottom: '10px', wordBreak: 'keep-all' }}>
              mebody 코드 플랜과
              <br />
              결제 관리를 여기서 진행합니다
            </h1>
            <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#4b5563', wordBreak: 'keep-all' }}>
              결과 저장, 재방문 연결, 심화 리포트와 루틴 확장에 필요한 구독 상태를 한 곳에서 확인할 수 있습니다.
            </p>
          </div>

          {!user ? (
            <div
              style={{
                borderRadius: '22px',
                border: '1px solid rgba(229,231,235,0.95)',
                background: '#ffffff',
                padding: '18px',
              }}
            >
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>로그인이 필요합니다</h2>
              <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#4b5563', wordBreak: 'keep-all' }}>
                결과 저장, 재방문 바로 보기, 코드 플랜 구독을 사용하려면 먼저 회원가입/로그인을 진행해주세요.
              </p>
              {onRequireAuth && (
                <button
                  type="button"
                  onClick={onRequireAuth}
                  style={{
                    marginTop: '14px',
                    display: 'inline-flex',
                    width: '100%',
                    height: '54px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '16px',
                    border: 'none',
                    background: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: 800,
                    boxShadow: '0 14px 28px rgba(20,184,166,0.20)',
                    cursor: 'pointer',
                  }}
                >
                  회원가입 / 로그인
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div
                style={{
                  borderRadius: '22px',
                  border: '1px solid rgba(167,243,208,0.95)',
                  background: 'linear-gradient(135deg, rgba(236,253,245,0.95) 0%, rgba(240,253,250,0.95) 100%)',
                  padding: '18px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#059669', marginBottom: '6px' }}>ACCOUNT</div>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '8px', wordBreak: 'break-all' }}>{user.email}</p>
                {mySubscription ? (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderRadius: '999px',
                      background: '#ffffff',
                      border: '1px solid rgba(167,243,208,0.95)',
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#047857',
                    }}
                  >
                    <CheckCircle2 size={15} />
                    활성 구독: {currentPlan?.name ?? mySubscription.plan_code}
                  </div>
                ) : (
                  <p style={{ fontSize: '14px', color: '#065f46' }}>현재 연결된 활성 구독이 없습니다.</p>
                )}
              </div>

              <div
                style={{
                  borderRadius: '22px',
                  border: '1px solid rgba(229,231,235,0.95)',
                  background: '#ffffff',
                  padding: '18px',
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#111827', fontSize: '15px', fontWeight: 800 }}>
                  <ShieldCheck size={18} color="#059669" />
                  코드 플랜 혜택
                </div>
                <div style={{ display: 'grid', gap: '8px', fontSize: '14px', lineHeight: 1.65, color: '#4b5563' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#10b981', fontWeight: 800 }}>•</span>
                    <span>결과 히스토리와 재방문 자동 연결</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#10b981', fontWeight: 800 }}>•</span>
                    <span>체형별 심화 리포트와 코드 가이드 확장</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#10b981', fontWeight: 800 }}>•</span>
                    <span>맞춤 10~15분 루틴과 추후 비교 기능 우선 적용</span>
                  </div>
                </div>
              </div>

              {loading ? (
                <div style={{ fontSize: '14px', color: '#6b7280' }}>요금제를 불러오는 중...</div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {plans.map((plan) => {
                    const isCurrent = mySubscription?.plan_code === plan.code && (mySubscription.status === 'active' || mySubscription.status === 'trialing');
                    const isRecommended = plan.code === 'pro_monthly' && !isCurrent;

                    return (
                      <section
                        key={plan.code}
                        style={{
                          borderRadius: '22px',
                          border: isCurrent
                            ? '1px solid rgba(167,243,208,0.95)'
                            : isRecommended
                              ? '1px solid rgba(110,231,183,0.95)'
                              : '1px solid rgba(229,231,235,0.95)',
                          background: isCurrent
                            ? 'linear-gradient(135deg, rgba(236,253,245,0.95) 0%, rgba(255,255,255,0.95) 100%)'
                            : '#ffffff',
                          padding: '18px',
                          boxShadow: isRecommended ? '0 16px 28px rgba(16,185,129,0.10)' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                          <div>
                            {isRecommended && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  borderRadius: '999px',
                                  background: 'rgba(236,253,245,0.95)',
                                  border: '1px solid rgba(167,243,208,0.95)',
                                  padding: '6px 10px',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  letterSpacing: '0.12em',
                                  color: '#047857',
                                  marginBottom: '8px',
                                }}
                              >
                                RECOMMENDED
                              </span>
                            )}
                            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', marginBottom: '6px' }}>{plan.name}</h3>
                            <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#4b5563', wordBreak: 'keep-all' }}>{plan.description}</p>
                          </div>
                          <Crown size={20} color={isCurrent ? '#059669' : '#9ca3af'} />
                        </div>

                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#111827', marginBottom: '12px' }}>
                          ₩{formatKrw(plan.price_krw)}
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#6b7280' }}> / {billingLabel(plan.billing_cycle)}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onSelectPlan?.(plan.code)}
                          style={{
                            display: 'inline-flex',
                            width: '100%',
                            height: '52px',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '16px',
                            border: isCurrent ? '1px solid rgba(167,243,208,0.95)' : 'none',
                            background: isCurrent
                              ? '#ffffff'
                              : isRecommended
                                ? 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)'
                                : 'rgba(243,244,246,0.95)',
                            color: isCurrent ? '#047857' : isRecommended ? '#ffffff' : '#374151',
                            fontSize: '15px',
                            fontWeight: 800,
                            boxShadow: isRecommended ? '0 14px 28px rgba(20,184,166,0.18)' : 'none',
                            cursor: 'pointer',
                          }}
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
