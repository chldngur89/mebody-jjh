/**
 * 멤버십 안내 — 셸 안에서(탭바를 유지한 채) 열립니다.
 *
 * 예전에는 100dvh 전체화면에 자체 헤더·자체 스크롤러를 갖고 있었습니다.
 * 셸 안으로 들어오면서 그 껍데기는 셸이 담당하고, 여기는 내용만 그립니다.
 *
 * 플랜은 하나뿐입니다(basic_monthly ₩5,900). Pro 는 035 에서 비활성으로 내렸습니다.
 */
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, Check, ChevronRight, ShieldCheck } from 'lucide-react';
import { fetchMembershipPlans, fetchMySubscription, type MembershipPlan, type UserSubscription } from '../api/account';
import { BRAND, SURFACE } from '../theme/brand';
import { Card, CTA, Chip, PageTitle, SectionHeading } from './ui';

interface MembershipScreenProps {
  user: User | null;
  onBack?: () => void;
  onRequireAuth?: () => void;
  onSelectPlan?: (planCode: string) => void;
}

function formatKrw(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value);
}

function cycleLabel(cycle: MembershipPlan['billing_cycle']): string {
  if (cycle === 'yearly') return '연';
  if (cycle === 'one_time') return '1회';
  return '월';
}

/** 무료와 멤버십의 차이. 화면 문구와 실제 규칙(034·035)이 어긋나지 않게 한곳에 둡니다. */
const BENEFITS: Array<{ title: string; free: string; paid: string }> = [
  { title: '14일 관리 루틴', free: '첫 1회 무료', paid: '무제한' },
  { title: '광고', free: '있음', paid: '없음' },
  { title: '미션 · 공통 스트레칭 적립', free: '기본', paid: '2배' },
  { title: 'mebody 상품 구매', free: '-', paid: '결제액의 5% 적립' },
  { title: '주간 리포트 · 2주 재측정 비교', free: '-', paid: '제공' },
];

export function MembershipScreen({ user, onBack, onRequireAuth, onSelectPlan }: MembershipScreenProps) {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [mySubscription, setMySubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([fetchMembershipPlans(), user ? fetchMySubscription(user.id) : Promise.resolve(null)])
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

  const plan = useMemo(() => plans[0] ?? null, [plans]);
  const isSubscribed = Boolean(mySubscription);

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{
            justifySelf: 'start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            border: 0,
            background: 'transparent',
            padding: '2px 0',
            color: BRAND.muted,
            fontSize: '13px',
            fontWeight: 800,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={15} /> 뒤로
        </button>
      )}
      <PageTitle
        eyebrow="MEMBERSHIP"
        title="mebody 멤버십"
        lead="14일 루틴을 이어서 하고, 광고 없이, 적립은 두 배로."
      />

      {loading ? (
        <Card>
          <p style={{ margin: 0, fontSize: '13px', color: BRAND.muted }}>멤버십 정보를 불러오는 중...</p>
        </Card>
      ) : (
        <>
          {isSubscribed && mySubscription && (
            <Card tone="green">
              <Chip tone="onGreen">이용 중</Chip>
              <h2 style={{ fontSize: '21px', fontWeight: 800, margin: '12px 0 6px', wordBreak: 'keep-all' }}>
                이미 멤버십 회원이세요
              </h2>
              <p style={{ margin: 0, color: 'rgba(255,255,255,.8)', fontSize: '13px', lineHeight: 1.6 }}>
                {mySubscription.current_period_end
                  ? `${new Date(mySubscription.current_period_end).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}까지 이용하실 수 있습니다.`
                  : '이용 중입니다.'}
                {mySubscription.cancel_at_period_end && ' 기간이 끝나면 해지됩니다.'}
              </p>
            </Card>
          )}

          {plan && (
            <Card>
              <SectionHeading kicker="플랜" title={plan.name} hint={`${cycleLabel(plan.billing_cycle)} 결제`} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '10px' }}>
                <strong style={{ fontSize: '32px', fontWeight: 900, color: BRAND.green, letterSpacing: '-1px' }}>
                  {formatKrw(plan.price_krw)}원
                </strong>
                <span style={{ fontSize: '13px', fontWeight: 800, color: BRAND.muted }}>
                  / {cycleLabel(plan.billing_cycle)}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.7, color: BRAND.muted, wordBreak: 'keep-all' }}>
                {plan.description}
              </p>
              {!isSubscribed && (
                <CTA
                  onClick={() => {
                    if (!user) {
                      onRequireAuth?.();
                      return;
                    }
                    onSelectPlan?.(plan.code);
                  }}
                >
                  멤버십 시작하기 <ChevronRight size={18} />
                </CTA>
              )}
            </Card>
          )}

          <Card>
            <SectionHeading kicker="비교" title="무료와 무엇이 다른가요" />
            <div style={{ display: 'grid', gap: '2px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.35fr .8fr .95fr',
                  gap: '8px',
                  padding: '0 2px 8px',
                  fontSize: '11px',
                  fontWeight: 900,
                  color: BRAND.muted,
                }}
              >
                <span />
                <span style={{ textAlign: 'center' }}>무료</span>
                <span style={{ textAlign: 'center', color: BRAND.green }}>멤버십</span>
              </div>
              {BENEFITS.map((b, i) => (
                <div
                  key={b.title}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.35fr .8fr .95fr',
                    gap: '8px',
                    alignItems: 'center',
                    padding: '11px 2px',
                    borderTop: i === 0 ? 'none' : `1px solid ${SURFACE.hairline}`,
                  }}
                >
                  <span style={{ fontSize: '12.5px', fontWeight: 800, wordBreak: 'keep-all' }}>{b.title}</span>
                  <span style={{ fontSize: '11.5px', color: BRAND.muted, textAlign: 'center', wordBreak: 'keep-all' }}>
                    {b.free}
                  </span>
                  <span
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 900,
                      color: BRAND.green,
                      textAlign: 'center',
                      wordBreak: 'keep-all',
                    }}
                  >
                    {b.paid}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeading kicker="안내" title="알아두실 점" />
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '9px' }}>
              {[
                '언제든 해지할 수 있고, 해지해도 남은 기간은 그대로 이용합니다.',
                '해지는 내 상태 → 멤버십에서 바로 하실 수 있습니다.',
                '적립금은 mebody 상품 구매에 사용할 수 있습니다.',
              ].map((line) => (
                <li key={line} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <Check size={15} color={BRAND.green} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '12.5px', lineHeight: 1.6, color: BRAND.muted, wordBreak: 'keep-all' }}>
                    {line}
                  </span>
                </li>
              ))}
            </ul>
            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
                marginTop: '14px',
                paddingTop: '13px',
                borderTop: `1px solid ${SURFACE.hairline}`,
              }}
            >
              <ShieldCheck size={15} color={BRAND.muted} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '11.5px', lineHeight: 1.6, color: BRAND.muted, wordBreak: 'keep-all' }}>
                mebody 는 의료 진단이 아닌 웰니스 셀프 체크 서비스입니다.
              </span>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
