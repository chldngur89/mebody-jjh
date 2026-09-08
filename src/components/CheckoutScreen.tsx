/**
 * 멤버십 결제 — 셸 안에서(탭바를 유지한 채) 끝납니다.
 *
 * 이 화면은 **결제를 요청만** 합니다. 멤버십을 켜는 건 서버입니다:
 *   앱 → 스토어 결제 → 영수증 토큰 → POST /api/billing/subscription/verify → 서버가 활성화
 *
 * 앱이 `user_subscriptions` 를 직접 쓸 수 없기 때문입니다(SELECT 권한만).
 * 예전 코드는 클라이언트에서 upsert 를 했는데 **항상 42501 로 실패**했고,
 * 성공했다면 그게 더 큰 문제였습니다 — 누구나 공짜로 멤버십을 켤 수 있으니까요.
 */
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, CheckCircle2, CreditCard, Info, ShieldCheck } from 'lucide-react';
import { fetchMembershipPlans, type MembershipPlan } from '../api/account';
import {
  BillingError,
  fetchBillingConfig,
  verifySubscription,
  type BillingConfig,
} from '../api/billing';
import { BRAND, SURFACE } from '../theme/brand';
import { Card, CTA, Chip, PageTitle, SectionHeading } from './ui';

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

/**
 * 스토어 결제에서 받아올 구매 토큰 자리.
 * 실제 연동 전까지는 이 기기·이 시점의 임시 값을 씁니다. 서버가 이 값을 거래 ID 로 삼아
 * 같은 결제가 두 번 반영되지 않게 하므로, 재시도해도 안전합니다.
 */
function purchaseTokenFor(userId: string, planCode: string): string {
  return `${userId}:${planCode}:${new Date().toISOString().slice(0, 10)}`;
}

export function CheckoutScreen({ user, planCode, onBack, onComplete, onRequireAuth }: CheckoutScreenProps) {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<BillingConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ until: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [list, config] = await Promise.all([fetchMembershipPlans(), fetchBillingConfig()]);
      if (cancelled) return;
      setPlans(list);
      setBilling(config);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const plan = useMemo(() => plans.find((p) => p.code === planCode) ?? null, [plans, planCode]);
  const canPay = Boolean(billing?.subscriptionProvider);

  const handlePay = async () => {
    if (!user) {
      onRequireAuth?.();
      return;
    }
    if (!plan) return;

    setSubmitting(true);
    setError(null);
    try {
      const state = await verifySubscription(plan.code, purchaseTokenFor(user.id, plan.code));
      setDone({ until: state?.currentPeriodEnd ?? null });
      onComplete?.();
    } catch (err) {
      setError(err instanceof BillingError ? err.message : '결제 처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={{ display: 'grid', gap: '14px' }}>
        <PageTitle eyebrow="CHECKOUT" title="결제 완료" />
        <Card tone="green">
          <CheckCircle2 size={30} />
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '12px 0 8px', wordBreak: 'keep-all' }}>
            멤버십이 시작되었습니다
          </h2>
          <p style={{ margin: 0, color: 'rgba(255,255,255,.8)', fontSize: '14px', lineHeight: 1.6, wordBreak: 'keep-all' }}>
            {done.until
              ? `${new Date(done.until).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}까지 이용하실 수 있어요.`
              : '이제 14일 루틴을 이어서 하실 수 있어요.'}
          </p>
          <CTA variant="light" onClick={onBack}>
            돌아가기
          </CTA>
        </Card>
        <Card>
          <SectionHeading kicker="멤버십" title="지금부터 열린 것" />
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', lineHeight: 1.9, color: BRAND.muted }}>
            <li>14일 관리 무제한</li>
            <li>광고 없이 이용</li>
            <li>미션 · 공통 스트레칭 적립 2배</li>
            <li>mebody 상품 구매 시 결제액의 5% 적립</li>
          </ul>
        </Card>
      </div>
    );
  }

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
      <PageTitle eyebrow="CHECKOUT" title="결제 진행" />

      {loading ? (
        <Card>
          <p style={{ margin: 0, fontSize: '13px', color: BRAND.muted }}>플랜을 불러오는 중...</p>
        </Card>
      ) : !plan ? (
        <Card>
          <p style={{ margin: 0, fontSize: '13px', color: BRAND.muted }}>선택한 플랜을 찾을 수 없습니다.</p>
          <CTA variant="outline" onClick={onBack}>
            멤버십으로 돌아가기
          </CTA>
        </Card>
      ) : (
        <>
          <Card>
            <SectionHeading kicker="주문 내용" title={plan.name} hint={plan.billing_cycle === 'monthly' ? '월 자동결제' : undefined} />
            <p style={{ margin: '0 0 14px', fontSize: '13px', lineHeight: 1.7, color: BRAND.muted, wordBreak: 'keep-all' }}>
              {plan.description}
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                borderTop: `1px solid ${SURFACE.hairline}`,
                paddingTop: '14px',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 800, color: BRAND.muted }}>결제 금액</span>
              <strong style={{ fontSize: '24px', fontWeight: 900, color: BRAND.green }}>
                {formatKrw(plan.price_krw)}원
              </strong>
            </div>
          </Card>

          {billing?.devMode && (
            <Card style={{ background: '#FFF8E8', border: '1px solid #F0DCA8' }}>
              <div style={{ display: 'flex', gap: '9px' }}>
                <Info size={16} color="#9A6B00" style={{ flexShrink: 0, marginTop: '1px' }} />
                <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.65, color: '#7A5500', wordBreak: 'keep-all' }}>
                  지금은 <b>테스트 결제</b>로 동작합니다. 실제로 돈이 빠져나가지 않습니다.
                  사업자등록과 결제사 연동이 끝나면 실결제로 바뀝니다.
                </p>
              </div>
            </Card>
          )}

          {!canPay && (
            <Card>
              <div style={{ display: 'flex', gap: '9px' }}>
                <Info size={16} color={BRAND.muted} style={{ flexShrink: 0, marginTop: '1px' }} />
                <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.65, color: BRAND.muted, wordBreak: 'keep-all' }}>
                  {billing?.serverMissing
                    ? '결제 서버가 아직 연결되지 않았습니다. 연결 후 이용하실 수 있습니다.'
                    : '결제 수단을 준비 중입니다. 준비가 끝나면 이 화면에서 바로 결제하실 수 있어요.'}
                  <br />
                  그동안에도 공통 스트레칭과 적립은 그대로 이용하실 수 있습니다.
                </p>
              </div>
            </Card>
          )}

          {error && (
            <Card style={{ background: '#FDF2F1', border: '1px solid #F3CFCB' }}>
              <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.6, color: '#8E3A32', wordBreak: 'keep-all' }}>{error}</p>
            </Card>
          )}

          <Card>
            <div style={{ display: 'flex', gap: '9px', marginBottom: '4px' }}>
              <ShieldCheck size={16} color={BRAND.green} style={{ flexShrink: 0, marginTop: '1px' }} />
              <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.65, color: BRAND.muted, wordBreak: 'keep-all' }}>
                결제 정보는 앱이 보관하지 않습니다. 멤버십 활성화는 결제 승인을 확인한 서버가 처리합니다.
              </p>
            </div>
            <CTA onClick={() => void handlePay()} disabled={submitting || !canPay}>
              <CreditCard size={17} />
              {submitting ? '처리 중...' : canPay ? `${formatKrw(plan.price_krw)}원 결제하기` : '결제 준비 중'}
            </CTA>
            {!user && (
              <p style={{ margin: '10px 0 0', fontSize: '11px', color: BRAND.muted, textAlign: 'center' }}>
                결제하려면 로그인이 필요합니다.
              </p>
            )}
          </Card>

          <Card>
            <SectionHeading kicker="안내" title="해지와 환불" />
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', lineHeight: 1.9, color: BRAND.muted }}>
              <li>언제든 해지할 수 있고, 해지해도 남은 기간은 그대로 이용합니다.</li>
              <li>해지는 내 상태 → 멤버십에서 할 수 있습니다.</li>
              <li>
                <Chip>웰니스 셀프 체크</Chip> 서비스이며 의료 행위가 아닙니다.
              </li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
