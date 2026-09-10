/**
 * 내 상태 화면의 확장 섹션 네 가지.
 *
 *   1) 프로필 편집   — 이름 · 이메일 · 비밀번호 · 휴대폰 · 키 · 몸무게
 *                      (미등록이면 빨간 경고 + 펼침, 완료면 접힘)
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
  isProfileComplete,
  saveMyProfile,
  updateMyEmail,
  updateMyPassword,
  validateBody,
  type MeasurementRecord,
  type MyProfile,
} from '../../api/profile';
import { compareJourneyResults } from '../../utils/journeyCompare';
import { formatPhone, isEmail, normalizePhone, phoneFromLoginEmail } from '../../lib/identifier';
import { BRAND, SURFACE } from '../../theme/brand';
import { PRODUCT } from '../../theme/copy';
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
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [phone, setPhone] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    const metaName =
      typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name.trim() : '';
    void fetchMyProfile(user.id).then((p) => {
      if (cancelled) return;
      setProfile(p);
      const seededName = p?.nickname?.trim() || p?.displayName?.trim() || metaName || '';
      setName(seededName);
      const authEmail = user.email?.trim() ?? '';
      const profileEmail = p?.email?.trim() ?? '';
      // 휴대폰 별칭 이메일은 연락용으로 보이지 않게 하고, 프로필에 다른 이메일이 있으면 그걸 우선합니다.
      const aliasPhone = phoneFromLoginEmail(authEmail);
      setEmail(aliasPhone ? (phoneFromLoginEmail(profileEmail) ? '' : profileEmail) : profileEmail || authEmail);

      const seededPhone = p?.phone || phoneFromLoginEmail(p?.email) || phoneFromLoginEmail(user.email) || '';
      setPhone(seededPhone ? formatPhone(seededPhone) : '');
      setHeight(p?.heightCm == null ? '' : String(p.heightCm));
      setWeight(p?.weightKg == null ? '' : String(p.weightKg));
      setPassword('');
      setPasswordConfirm('');
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user.id, user.email, user.user_metadata?.display_name]);

  const metaName =
    typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name.trim() : '';
  const incomplete =
    loaded &&
    !isProfileComplete({
      nickname: profile?.nickname,
      displayName: profile?.displayName || metaName,
      phone: profile?.phone,
      heightCm: profile?.heightCm,
      weightKg: profile?.weightKg,
      email: profile?.email ?? user.email,
    });

  useEffect(() => {
    if (!loaded) return;
    setOpen(incomplete);
  }, [loaded, incomplete]);

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNotice({ text: '이름을 입력해주세요.', ok: false });
      setOpen(true);
      return;
    }

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
    if (h === null || w === null) {
      setNotice({ text: '키와 몸무게를 모두 입력해주세요.', ok: false });
      setOpen(true);
      return;
    }

    let nextPhone: string | null = null;
    if (phone.trim()) {
      nextPhone = normalizePhone(phone);
      if (!nextPhone) {
        setNotice({ text: '휴대폰 번호를 다시 확인해주세요.', ok: false });
        return;
      }
    } else {
      setNotice({ text: '휴대폰 번호를 입력해주세요.', ok: false });
      setOpen(true);
      return;
    }

    const nextEmail = email.trim().toLowerCase();
    if (nextEmail && !isEmail(nextEmail)) {
      setNotice({ text: '이메일 형식이 올바르지 않습니다.', ok: false });
      return;
    }
    if (password || passwordConfirm) {
      if (!password) {
        setNotice({ text: '새 비밀번호를 입력해주세요.', ok: false });
        return;
      }
      if (password !== passwordConfirm) {
        setNotice({ text: '비밀번호 확인이 일치하지 않습니다.', ok: false });
        return;
      }
    }

    setSaving(true);
    setNotice(null);

    const authEmail = user.email?.trim().toLowerCase() ?? '';
    if (nextEmail && nextEmail !== authEmail && !phoneFromLoginEmail(authEmail)) {
      const emailResult = await updateMyEmail(nextEmail);
      if (!emailResult.ok) {
        setSaving(false);
        setNotice({ text: emailResult.message, ok: false });
        return;
      }
    } else if (nextEmail && phoneFromLoginEmail(authEmail) && nextEmail !== authEmail) {
      // 휴대폰 가입자는 로그인 별칭은 유지하고, 연락 이메일만 프로필에 둡니다.
    }

    if (password) {
      const passwordResult = await updateMyPassword(password);
      if (!passwordResult.ok) {
        setSaving(false);
        setNotice({ text: passwordResult.message, ok: false });
        return;
      }
    }

    const next = await saveMyProfile(
      user.id,
      profile?.id ?? null,
      {
        nickname: trimmedName,
        phone: nextPhone,
        heightCm: h,
        weightKg: w,
      },
      { email: nextEmail || authEmail || null },
    );
    setSaving(false);
    if (!next) {
      setNotice({ text: '저장하지 못했습니다. 잠시 후 다시 시도해주세요.', ok: false });
      return;
    }
    setProfile(next);
    setName(next.nickname ?? next.displayName ?? trimmedName);
    if (next.phone) setPhone(formatPhone(next.phone));
    setPassword('');
    setPasswordConfirm('');
    const done = isProfileComplete(next);
    setOpen(!done);
    setNotice({
      text: done
        ? password
          ? '저장되었습니다. 비밀번호도 변경되었습니다.'
          : nextEmail && nextEmail !== authEmail && !phoneFromLoginEmail(authEmail)
            ? '저장되었습니다. 이메일 변경은 확인 메일을 확인해주세요.'
            : '저장되었습니다.'
        : '저장되었습니다. 남은 항목도 이어서 입력해주세요.',
      ok: true,
    });
  };

  const passwordMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  return (
    <Collapsible
      title={incomplete ? '내 정보를 입력해주세요' : '내 정보 수정 및 비밀 번호 변경'}
      hint={incomplete ? '입력 필요' : '완료'}
      tone={incomplete ? 'danger' : 'default'}
      open={open}
      onOpenChange={setOpen}
      dense
    >
      <div style={{ display: 'grid', gap: '8px' }}>
        {incomplete && (
          <p
            style={{
              margin: 0,
              fontSize: '11.5px',
              lineHeight: 1.45,
              fontWeight: 800,
              color: '#8E3A32',
              wordBreak: 'keep-all',
            }}
          >
            이름 · 휴대폰 · 키 · 몸무게를 모두 등록해 주세요.
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <Field compact label="이름" value={name} onChange={setName} placeholder="이름" autoComplete="name" />
          <Field
            compact
            label="휴대폰"
            value={phone}
            onChange={(value) => setPhone(formatPhone(value))}
            placeholder="010-0000-0000"
            inputMode="tel"
            autoComplete="tel"
          />
        </div>

        <Field
          compact
          label="이메일"
          value={email}
          onChange={setEmail}
          placeholder="email@example.com"
          inputMode="email"
          autoComplete="email"
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <Field
            compact
            label="새 비밀번호"
            value={password}
            onChange={setPassword}
            placeholder="변경 시에만"
            type="password"
            autoComplete="new-password"
          />
          <Field
            compact
            label="비밀번호 확인"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            placeholder="다시 입력"
            type="password"
            autoComplete="new-password"
            invalid={passwordMismatch}
          />
        </div>
        {passwordMismatch && (
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#8E3A32' }}>
            비밀번호 확인이 일치하지 않습니다.
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <Field compact label="키 (cm)" value={height} onChange={setHeight} placeholder="170" inputMode="decimal" />
          <Field compact label="몸무게 (kg)" value={weight} onChange={setWeight} placeholder="65" inputMode="decimal" />
        </div>

        <p style={{ margin: '2px 0 0', fontSize: '10.5px', lineHeight: 1.45, color: BRAND.muted, wordBreak: 'keep-all' }}>
          비밀번호는 바꿀 때만 입력하세요. 키·몸무게는 {PRODUCT.codeName} 계산에 쓰이지 않습니다.
        </p>

        {notice && (
          <p
            style={{
              margin: 0,
              fontSize: '11.5px',
              fontWeight: 800,
              color: notice.ok ? BRAND.green : '#8E3A32',
              wordBreak: 'keep-all',
            }}
          >
            {notice.text}
          </p>
        )}

        <CTA
          onClick={() => void save()}
          disabled={saving || !loaded || passwordMismatch}
          style={{ marginTop: '6px', padding: '11px 14px', fontSize: '14px', borderRadius: '12px', gap: '6px' }}
        >
          <Save size={15} /> {saving ? '저장 중...' : '저장'}
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

const MEASUREMENT_VISIBLE = 3;

export function MeasurementSection({ user, onOpenResult }: { user: User; onOpenResult?: (id: string) => void }) {
  const [records, setRecords] = useState<MeasurementRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // 화면에 3개만 보여도, 3번째의 「직전 대비」를 위해 하나 더 읽습니다.
    void fetchMeasurementHistory(user.id, MEASUREMENT_VISIBLE + 1).then((list) => {
      if (cancelled) return;
      setRecords(list);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const visible = records.slice(0, MEASUREMENT_VISIBLE);

  return (
    <Collapsible
      kicker="기록"
      title="측정 기록"
      hint={visible.length > 0 ? `최근 ${visible.length}회` : undefined}
    >
      {loading ? (
        <p style={{ margin: 0, fontSize: '13px', color: BRAND.muted }}>불러오는 중...</p>
      ) : visible.length === 0 ? (
        <p style={{ margin: 0, fontSize: '12.5px', color: BRAND.muted }}>아직 완료한 측정이 없습니다.</p>
      ) : (
        <div style={{ display: 'grid' }}>
          {visible.map((record, index) => {
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
  autoComplete,
  type = 'text',
  invalid = false,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: 'text' | 'decimal' | 'tel' | 'email';
  autoComplete?: string;
  type?: 'text' | 'password' | 'email';
  invalid?: boolean;
  compact?: boolean;
}) {
  return (
    <label style={{ display: 'grid', gap: compact ? '3px' : '5px', minWidth: 0 }}>
      <span style={{ fontSize: compact ? '10.5px' : '11.5px', fontWeight: 900, color: BRAND.muted }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          height: compact ? '38px' : '42px',
          borderRadius: compact ? '10px' : '12px',
          border: `1px solid ${invalid ? '#dc2626' : SURFACE.hairline}`,
          padding: compact ? '0 10px' : '0 12px',
          fontSize: compact ? '12.5px' : '13px',
          fontFamily: 'inherit',
          outline: 'none',
          background: '#ffffff',
        }}
      />
    </label>
  );
}
