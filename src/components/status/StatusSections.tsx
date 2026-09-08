/**
 * 내 상태 화면의 확장 섹션 네 가지.
 *
 *   1) 프로필 편집   — 닉네임 · 키 · 몸무게 (037 이 만들어 두고 안 쓰던 컬럼을 여기서 처음 씁니다)
 *   2) 주문 내역     — fetchMyOrders() 는 있었는데 부르는 화면이 없었습니다
 *   3) 멤버십 관리   — 다음 결제일 · 해지. **해지도 서버가 합니다**(앱은 구독을 못 바꿉니다)
 *   4) 측정 기록     — 지난 진단 목록과 직전 대비 변화(compareJourneyResults 재사용)
 *
 * 카드가 많아져서 접이식으로 묶었습니다.
 */
import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Package, Save, Truck } from 'lucide-react';
import { fetchMySubscription, type UserSubscription } from '../../api/account';
import { BillingError, cancelOrder, cancelSubscription } from '../../api/billing';
import { fetchMyOrders, type FulfillmentStatus, type MyOrder } from '../../api/orders';
import {
  fetchMeasurementHistory,
  fetchMyProfile,
  updateMyProfile,
  validateBody,
  type MeasurementRecord,
  type MyProfile,
} from '../../api/profile';
import { compareJourneyResults } from '../../utils/journeyCompare';
import { BRAND, SURFACE } from '../../theme/brand';
import { Collapsible, CTA } from '../ui';

function krw(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value);
}

function day(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

const ORDER_STATUS: Record<MyOrder['status'], { label: string; color: string; bg: string }> = {
  PENDING: { label: '결제 대기', color: '#8A6D1F', bg: '#FFF8E8' },
  PAID: { label: '결제 완료', color: '#046B41', bg: '#E8F5EE' },
  CANCELED: { label: '취소됨', color: '#6B7280', bg: '#F3F4F6' },
  FAILED: { label: '실패', color: '#8E3A32', bg: '#FDF2F1' },
};

/** 배송 단계. 결제만 끝나고 아직 준비 전이면 NONE 입니다. */
const FULFILLMENT: Record<FulfillmentStatus, { label: string; step: number }> = {
  NONE: { label: '배송 준비 전', step: 0 },
  PREPARING: { label: '배송 준비 중', step: 1 },
  SHIPPED: { label: '배송 중', step: 2 },
  DELIVERED: { label: '배송 완료', step: 3 },
};

const FULFILLMENT_STEPS: FulfillmentStatus[] = ['PREPARING', 'SHIPPED', 'DELIVERED'];

/** 배송 진행을 점 세 개로 보여줍니다. 취소된 주문에는 그리지 않습니다. */
function FulfillmentTrack({ order }: { order: MyOrder }) {
  const current = FULFILLMENT[order.fulfillmentStatus];
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        {FULFILLMENT_STEPS.map((step, index) => {
          const done = current.step >= index + 1;
          return (
            <div key={step} style={{ flex: 1, display: 'grid', gap: '4px', justifyItems: 'center' }}>
              <span
                style={{
                  width: '100%',
                  height: '4px',
                  borderRadius: '999px',
                  background: done ? BRAND.green : SURFACE.hairline,
                }}
              />
              <span style={{ fontSize: '10px', fontWeight: done ? 900 : 700, color: done ? BRAND.green : BRAND.muted }}>
                {FULFILLMENT[step].label}
              </span>
            </div>
          );
        })}
      </div>
      {order.trackingNo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '8px' }}>
          <Truck size={13} color={BRAND.muted} />
          <span style={{ fontSize: '11.5px', color: BRAND.muted }}>
            {order.trackingCarrier ?? '택배'} {order.trackingNo}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 1) 프로필

export function ProfileSection({ user }: { user: User }) {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [nickname, setNickname] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchMyProfile(user.id).then((p) => {
      if (cancelled || !p) return;
      setProfile(p);
      setNickname(p.nickname ?? '');
      setHeight(p.heightCm === null ? '' : String(p.heightCm));
      setWeight(p.weightKg === null ? '' : String(p.weightKg));
    });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const save = async () => {
    if (!profile) return;
    const h = height.trim() === '' ? null : Number(height);
    const w = weight.trim() === '' ? null : Number(weight);
    if ((h !== null && Number.isNaN(h)) || (w !== null && Number.isNaN(w))) {
      setNotice({ text: '키와 몸무게는 숫자로 입력해주세요.', ok: false });
      return;
    }
    const invalid = validateBody(h, w);
    if (invalid) {
      setNotice({ text: invalid, ok: false });
      return;
    }

    setSaving(true);
    setNotice(null);
    const next = await updateMyProfile(profile.id, {
      nickname: nickname.trim() || null,
      heightCm: h,
      weightKg: w,
    });
    setSaving(false);
    if (!next) {
      setNotice({ text: '저장하지 못했습니다. 잠시 후 다시 시도해주세요.', ok: false });
      return;
    }
    setProfile(next);
    setNotice({ text: '저장되었습니다.', ok: true });
  };

  const bmi =
    profile?.heightCm && profile?.weightKg
      ? (profile.weightKg / (profile.heightCm / 100) ** 2).toFixed(1)
      : null;

  return (
    <Collapsible
      kicker="계정"
      title="내 정보"
      hint={bmi ? `BMI ${bmi}` : profile?.nickname ? profile.nickname : undefined}
    >
      <div style={{ display: 'grid', gap: '10px' }}>
        <Field label="닉네임" value={nickname} onChange={setNickname} placeholder="앱에서 부를 이름" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Field label="키 (cm)" value={height} onChange={setHeight} placeholder="170" inputMode="decimal" />
          <Field label="몸무게 (kg)" value={weight} onChange={setWeight} placeholder="65" inputMode="decimal" />
        </div>
        <p style={{ margin: 0, fontSize: '11px', lineHeight: 1.6, color: BRAND.muted, wordBreak: 'keep-all' }}>
          키와 몸무게는 선택입니다. 넣어두시면 이후 리포트에서 변화를 함께 보여드립니다.
          체형 코드 계산에는 쓰이지 않습니다.
        </p>
        {notice && (
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              fontWeight: 800,
              color: notice.ok ? BRAND.green : '#8E3A32',
            }}
          >
            {notice.text}
          </p>
        )}
        <CTA onClick={() => void save()} disabled={saving || !profile} style={{ marginTop: '4px' }}>
          <Save size={16} /> {saving ? '저장 중...' : '저장'}
        </CTA>
      </div>
    </Collapsible>
  );
}

// ---------------------------------------------------------------- 2) 주문 내역

export function OrdersSection({
  user,
  reloadKey = 0,
  onChanged,
}: {
  user: User;
  reloadKey?: number;
  /** 취소로 적립금이 바뀌면 상위가 잔액을 다시 읽도록 알립니다 */
  onChanged?: () => void;
}) {
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchMyOrders(user.id).then((list) => {
      if (cancelled) return;
      setOrders(list);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user.id, reloadKey, tick]);

  const cancel = async (order: MyOrder) => {
    if (!window.confirm(`${krw(order.totalKrw)}원 주문을 취소할까요? 사용한 적립금은 돌려드리고, 지급된 구매 적립은 회수됩니다.`)) return;
    setBusyId(order.id);
    setNotice(null);
    try {
      const result = await cancelOrder(order.id, '고객 요청');
      setNotice({
        text: result.changed
          ? `주문이 취소되었습니다.${result.refunded > 0 ? ` 적립금 ${krw(result.refunded)}원을 돌려드렸습니다.` : ''}`
          : '이미 취소된 주문입니다.',
        ok: true,
      });
      setTick((v) => v + 1);
      onChanged?.();
    } catch (err) {
      setNotice({
        text: err instanceof BillingError ? err.message : '주문을 취소하지 못했습니다.',
        ok: false,
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Collapsible kicker="마켓" title="주문 내역" hint={orders.length > 0 ? `${orders.length}건` : undefined}>
      {loading ? (
        <p style={{ margin: 0, fontSize: '13px', color: BRAND.muted }}>불러오는 중...</p>
      ) : orders.length === 0 ? (
        <div style={{ display: 'grid', placeItems: 'center', gap: '8px', padding: '12px 0' }}>
          <Package size={22} color={BRAND.muted} />
          <p style={{ margin: 0, fontSize: '12.5px', color: BRAND.muted, textAlign: 'center' }}>
            아직 주문 내역이 없습니다.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid' }}>
          {orders.map((order, index) => {
            const tone = ORDER_STATUS[order.status];
            return (
              <div
                key={order.id}
                style={{
                  padding: '13px 0',
                  borderTop: index === 0 ? 'none' : `1px solid ${SURFACE.hairline}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 900,
                        color: tone.color,
                        background: tone.bg,
                        borderRadius: '999px',
                        padding: '3px 8px',
                      }}
                    >
                      {tone.label}
                    </span>
                    <span style={{ fontSize: '11.5px', color: BRAND.muted }}>{day(order.createdAt)}</span>
                  </div>
                  {order.items.length > 0 && (
                    <div style={{ fontSize: '12px', fontWeight: 800, marginTop: '5px', wordBreak: 'keep-all' }}>
                      {order.items.map((i) => `${i.name} x${i.quantity}`).join(', ')}
                    </div>
                  )}
                  {order.rewardUsed > 0 && (
                    <div style={{ fontSize: '11.5px', color: BRAND.muted, marginTop: '4px' }}>
                      적립금 {krw(order.rewardUsed)}원 사용
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: BRAND.green }}>{krw(order.totalKrw)}원</div>
                  {order.subtotalKrw !== order.totalKrw && (
                    <div style={{ fontSize: '11px', color: BRAND.muted, textDecoration: 'line-through' }}>
                      {krw(order.subtotalKrw)}원
                    </div>
                  )}
                </div>
                </div>

                {order.status === 'PAID' && <FulfillmentTrack order={order} />}

                {order.cancelable && (
                  <button
                    type="button"
                    onClick={() => void cancel(order)}
                    disabled={busyId === order.id}
                    style={{
                      marginTop: '10px',
                      border: `1px solid ${SURFACE.hairline}`,
                      background: '#ffffff',
                      color: BRAND.muted,
                      borderRadius: '10px',
                      padding: '7px 12px',
                      fontSize: '12px',
                      fontWeight: 800,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    {busyId === order.id ? '처리 중...' : '주문 취소'}
                  </button>
                )}
                {order.status === 'PAID' && !order.cancelable && (
                  <p style={{ margin: '8px 0 0', fontSize: '11px', color: BRAND.muted }}>
                    발송된 뒤에는 취소할 수 없습니다. 반품은 고객센터로 문의해주세요.
                  </p>
                )}
              </div>
            );
          })}
          {notice && (
            <p
              style={{
                margin: '10px 0 0',
                fontSize: '12px',
                fontWeight: 800,
                color: notice.ok ? BRAND.green : '#8E3A32',
                wordBreak: 'keep-all',
              }}
            >
              {notice.text}
            </p>
          )}
        </div>
      )}
    </Collapsible>
  );
}

// ---------------------------------------------------------------- 3) 멤버십 관리

export function MembershipSection({
  user,
  isPaid,
  onOpenMembership,
  onChanged,
}: {
  user: User;
  isPaid: boolean;
  onOpenMembership?: () => void;
  onChanged?: () => void;
}) {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const reload = useCallback(async () => {
    setSubscription(await fetchMySubscription(user.id));
  }, [user.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const cancel = async () => {
    if (!window.confirm('이용 기간이 끝나면 해지됩니다. 남은 기간은 그대로 이용하실 수 있어요. 해지할까요?')) return;
    setWorking(true);
    setNotice(null);
    try {
      await cancelSubscription(false);
      setNotice({ text: '이용 기간이 끝나면 해지됩니다.', ok: true });
      await reload();
      onChanged?.();
    } catch (err) {
      setNotice({
        text: err instanceof BillingError ? err.message : '해지 처리에 실패했습니다.',
        ok: false,
      });
    } finally {
      setWorking(false);
    }
  };

  return (
    <Collapsible kicker="멤버십" title="멤버십 관리" hint={isPaid ? '이용 중' : '무료'} defaultOpen={isPaid}>
      {isPaid && subscription ? (
        <div style={{ display: 'grid', gap: '9px' }}>
          <Row label="플랜" value={subscription.plan_code === 'basic_monthly' ? 'mebody 멤버십' : subscription.plan_code} />
          <Row label="시작일" value={day(subscription.started_at)} />
          <Row
            label={subscription.cancel_at_period_end ? '이용 종료일' : '다음 결제일'}
            value={day(subscription.current_period_end)}
          />
          {subscription.cancel_at_period_end ? (
            <p style={{ margin: '4px 0 0', fontSize: '12px', lineHeight: 1.6, color: BRAND.muted, wordBreak: 'keep-all' }}>
              해지 예약 상태입니다. 위 날짜까지는 그대로 이용하실 수 있습니다.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={working}
              style={{
                marginTop: '4px',
                justifySelf: 'start',
                border: 0,
                background: 'transparent',
                color: BRAND.muted,
                fontSize: '12.5px',
                fontWeight: 800,
                fontFamily: 'inherit',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              {working ? '처리 중...' : '멤버십 해지'}
            </button>
          )}
          {notice && (
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: notice.ok ? BRAND.green : '#8E3A32' }}>
              {notice.text}
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '8px' }}>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', lineHeight: 1.9, color: BRAND.muted }}>
            <li>14일 관리 무제한</li>
            <li>광고 없이 이용</li>
            <li>미션 · 공통 스트레칭 적립 2배</li>
            <li>상품 구매 시 결제액의 5% 적립</li>
          </ul>
          <CTA onClick={onOpenMembership} style={{ marginTop: '4px' }}>
            멤버십 보기
          </CTA>
        </div>
      )}
    </Collapsible>
  );
}

// ---------------------------------------------------------------- 4) 측정 기록

export function MeasurementSection({ user, onOpenResult }: { user: User; onOpenResult?: (id: string) => void }) {
  const [records, setRecords] = useState<MeasurementRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchMeasurementHistory(user.id, 10).then((list) => {
      if (cancelled) return;
      setRecords(list);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  return (
    <Collapsible kicker="기록" title="측정 기록" hint={records.length > 0 ? `${records.length}회` : undefined}>
      {loading ? (
        <p style={{ margin: 0, fontSize: '13px', color: BRAND.muted }}>불러오는 중...</p>
      ) : records.length === 0 ? (
        <p style={{ margin: 0, fontSize: '12.5px', color: BRAND.muted }}>아직 완료한 측정이 없습니다.</p>
      ) : (
        <div style={{ display: 'grid' }}>
          {records.map((record, index) => {
            const previous = records[index + 1];
            // 직전 측정 대비 무엇이 달라졌는지. 축 데이터가 없으면 요약이 비어 표시하지 않습니다.
            const comparison = previous
              ? compareJourneyResults(
                  { calculated_code: previous.code, scoring_meta: previous.scoringMeta as never },
                  { calculated_code: record.code, scoring_meta: record.scoringMeta as never },
                )
              : null;
            return (
              <button
                key={record.id}
                type="button"
                onClick={() => onOpenResult?.(record.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '11px',
                  width: '100%',
                  textAlign: 'left',
                  border: 0,
                  borderTop: index === 0 ? 'none' : `1px solid ${SURFACE.hairline}`,
                  background: 'transparent',
                  padding: '12px 0',
                  cursor: onOpenResult ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    background: index === 0 ? BRAND.green : SURFACE.subtle,
                    color: index === 0 ? '#ffffff' : BRAND.green,
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 900,
                    fontSize: '13px',
                  }}
                >
                  {record.code || '----'}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 800 }}>
                    {day(record.measuredAt)}
                    {index === 0 && (
                      <span style={{ marginLeft: '6px', fontSize: '10.5px', fontWeight: 900, color: BRAND.green }}>
                        최근
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '11.5px',
                      color: BRAND.muted,
                      marginTop: '3px',
                      lineHeight: 1.5,
                      wordBreak: 'keep-all',
                    }}
                  >
                    {comparison?.summary ?? (previous ? '변화를 계산할 자료가 없습니다.' : '첫 측정입니다.')}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Collapsible>
  );
}

// ---------------------------------------------------------------- 공용

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
      <span style={{ color: BRAND.muted, fontWeight: 700 }}>{label}</span>
      <span style={{ fontWeight: 800 }}>{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: 'text' | 'decimal';
}) {
  return (
    <label style={{ display: 'grid', gap: '5px' }}>
      <span style={{ fontSize: '11.5px', fontWeight: 900, color: BRAND.muted }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        style={{
          height: '42px',
          borderRadius: '12px',
          border: `1px solid ${SURFACE.hairline}`,
          padding: '0 12px',
          fontSize: '13px',
          fontFamily: 'inherit',
          outline: 'none',
          background: '#ffffff',
        }}
      />
    </label>
  );
}
