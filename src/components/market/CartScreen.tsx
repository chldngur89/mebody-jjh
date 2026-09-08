import { useOverlayBack } from '../../utils/useOverlayBack';
/**
 * 장바구니 · 주문서 — 담기부터 결제까지 앱 안에서 끝납니다.
 *
 * 흐름:
 *   담은 상품 → 배송지 → 적립금 사용 → 주문 생성(create_order) → 결제 승인(서버) → 5% 적립
 *
 * 금액은 화면에서 계산하지 않습니다. 여기 숫자는 **표시용**이고,
 * 실제 소계·적립금 차감·총액은 서버의 create_order 가 상품 테이블을 다시 읽어 정합니다.
 * 결제 승인과 PAID 전환도 서버만 합니다(앱은 orders 에 SELECT 권한만).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, CheckCircle2, Info, Minus, Plus, Trash2, Truck } from 'lucide-react';
import { createAddress, fetchMyAddresses, type UserAddress } from '../../api/addresses';
import { BillingError, confirmOrderPayment, fetchBillingConfig, type BillingConfig } from '../../api/billing';
import { fetchStoreProducts, type StoreProduct } from '../../api/content';
import { fetchRewardBalance } from '../../api/journey';
import { claimPurchaseReward, createOrder, previewRewardUse } from '../../api/orders';
import { clearCart, onCartChange, readCart, removeFromCart, setQuantity, type CartLine } from '../../lib/cart';
import { BRAND, SURFACE } from '../../theme/brand';
import { Card, CTA, PageTitle, SectionHeading } from '../ui';

export interface CartScreenProps {
  user: User | null;
  isPaid?: boolean;
  onBack?: () => void;
  onRequireAuth?: () => void;
  onContinueShopping?: () => void;
  /** 결제가 끝나면 적립금·주문 내역을 다시 읽도록 알립니다 */
  onPaid?: () => void;
}

function krw(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value);
}

export function CartScreen({ user, isPaid = false, onBack, onRequireAuth, onContinueShopping, onPaid }: CartScreenProps) {
  const [lines, setLines] = useState<CartLine[]>(() => readCart());
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [useReward, setUseReward] = useState(0);
  const [billing, setBilling] = useState<BillingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ total: number; earned: number } | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const closeAddressForm = useOverlayBack(showAddressForm, () => setShowAddressForm(false));
  const [form, setForm] = useState({ recipient: '', phone: '', postcode: '', address1: '', address2: '' });

  useEffect(() => onCartChange(() => setLines(readCart())), []);

  const reload = useCallback(async () => {
    const [list, config, addr, bal] = await Promise.all([
      fetchStoreProducts(),
      fetchBillingConfig(),
      user ? fetchMyAddresses() : Promise.resolve([] as UserAddress[]),
      user ? fetchRewardBalance(user.id) : Promise.resolve(0),
    ]);
    setProducts(list);
    setBilling(config);
    setAddresses(addr);
    setAddressId((prev) => prev ?? addr.find((a) => a.isDefault)?.id ?? addr[0]?.id ?? null);
    setBalance(bal);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const rows = useMemo(
    () =>
      lines
        .map((line) => ({ line, product: products.find((p) => p.id === line.productId) }))
        .filter((row): row is { line: CartLine; product: StoreProduct } => Boolean(row.product)),
    [lines, products],
  );

  const subtotal = useMemo(
    () => rows.reduce((sum, { line, product }) => sum + (product.price ?? 0) * line.quantity, 0),
    [rows],
  );
  const maxReward = previewRewardUse(subtotal, balance);
  const applied = Math.min(useReward, maxReward);
  const total = Math.max(0, subtotal - applied);
  const cashback = isPaid ? Math.floor((total * 5) / 100) : 0;
  const canPay = Boolean(billing?.orderProvider);
  const address = addresses.find((a) => a.id === addressId) ?? null;

  const saveAddress = async () => {
    if (!user) return;
    if (!form.recipient.trim() || !form.phone.trim() || !form.postcode.trim() || !form.address1.trim()) {
      setError('받는 분, 연락처, 우편번호, 주소를 모두 입력해주세요.');
      return;
    }
    setWorking(true);
    setError(null);
    const created = await createAddress(user.id, {
      recipient: form.recipient.trim(),
      phone: form.phone.trim(),
      postcode: form.postcode.trim(),
      address1: form.address1.trim(),
      address2: form.address2.trim() || null,
      isDefault: addresses.length === 0,
    });
    setWorking(false);
    if (!created) {
      setError('배송지를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    setAddresses((prev) => [created, ...prev]);
    setAddressId(created.id);
    setShowAddressForm(false);
    setForm({ recipient: '', phone: '', postcode: '', address1: '', address2: '' });
  };

  const pay = async () => {
    if (!user) {
      onRequireAuth?.();
      return;
    }
    if (rows.length === 0) return;
    if (!addressId) {
      setError('배송지를 먼저 등록해주세요.');
      return;
    }

    setWorking(true);
    setError(null);
    try {
      // 1) 주문 생성 — 금액은 여기서 서버가 정합니다.
      const order = await createOrder(
        rows.map(({ line }) => ({ productId: line.productId, quantity: line.quantity })),
        applied,
        addressId,
      );
      if (!order) {
        setError('주문을 만들지 못했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      // 2) 결제 승인 → PAID. 앱은 주문 상태를 직접 바꿀 수 없습니다.
      await confirmOrderPayment(order.orderId, `${order.orderId}:${Date.now()}`);

      // 3) 멤버십이면 결제액의 5% 적립
      const reward = await claimPurchaseReward(order.orderId);

      clearCart();
      setDone({ total: order.total, earned: reward?.amount ?? 0 });
      onPaid?.();
    } catch (err) {
      setError(err instanceof BillingError ? err.message : '결제 처리 중 오류가 발생했습니다.');
    } finally {
      setWorking(false);
    }
  };

  if (done) {
    return (
      <div style={{ display: 'grid', gap: '14px' }}>
        <PageTitle eyebrow="ORDER" title="주문 완료" />
        <Card tone="green">
          <CheckCircle2 size={30} />
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '12px 0 8px' }}>결제가 완료되었습니다</h2>
          <p style={{ margin: 0, color: 'rgba(255,255,255,.8)', fontSize: '14px', lineHeight: 1.6, wordBreak: 'keep-all' }}>
            {krw(done.total)}원을 결제했습니다.
            {done.earned > 0 && ` 멤버십 적립 ${krw(done.earned)}원이 쌓였습니다.`}
          </p>
          <CTA variant="light" onClick={onContinueShopping}>
            마켓으로 돌아가기
          </CTA>
        </Card>
        <Card>
          <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.7, color: BRAND.muted, wordBreak: 'keep-all' }}>
            주문 내역은 <b>내 상태 → 주문 내역</b>에서 확인하실 수 있습니다.
          </p>
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
          <ArrowLeft size={15} /> 마켓으로
        </button>
      )}
      <PageTitle eyebrow="CART" title="장바구니" />

      {loading ? (
        <Card>
          <p style={{ margin: 0, fontSize: '13px', color: BRAND.muted }}>불러오는 중...</p>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.7, color: BRAND.muted }}>
            담은 상품이 없습니다. 마켓에서 필요한 관리 도구를 담아보세요.
          </p>
          <CTA variant="outline" onClick={onContinueShopping}>
            마켓 보기
          </CTA>
        </Card>
      ) : (
        <>
          <Card>
            <SectionHeading kicker="담은 상품" title={`${rows.length}개`} />
            <div style={{ display: 'grid' }}>
              {rows.map(({ line, product }, index) => (
                <div
                  key={line.productId}
                  style={{
                    display: 'flex',
                    gap: '11px',
                    alignItems: 'center',
                    padding: '12px 0',
                    borderTop: index === 0 ? 'none' : `1px solid ${SURFACE.hairline}`,
                  }}
                >
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      flexShrink: 0,
                      borderRadius: '12px',
                      background: SURFACE.placeholder,
                      overflow: 'hidden',
                    }}
                  >
                    {product.imageUrl && (
                      <img src={product.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, wordBreak: 'keep-all' }}>{product.name}</div>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: BRAND.green, marginTop: '3px' }}>
                      {krw((product.price ?? 0) * line.quantity)}원
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <QtyButton label="수량 줄이기" onClick={() => setLines(setQuantity(line.productId, line.quantity - 1))}>
                      <Minus size={13} />
                    </QtyButton>
                    <span style={{ minWidth: '20px', textAlign: 'center', fontSize: '13px', fontWeight: 900 }}>
                      {line.quantity}
                    </span>
                    <QtyButton label="수량 늘리기" onClick={() => setLines(setQuantity(line.productId, line.quantity + 1))}>
                      <Plus size={13} />
                    </QtyButton>
                    <QtyButton label="삭제" onClick={() => setLines(removeFromCart(line.productId))}>
                      <Trash2 size={13} />
                    </QtyButton>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeading kicker="배송지" title={address ? '배송받을 곳' : '배송지 등록'} />
            {!user ? (
              <p style={{ margin: 0, fontSize: '13px', color: BRAND.muted }}>로그인하면 배송지를 저장할 수 있습니다.</p>
            ) : addresses.length > 0 && !showAddressForm ? (
              <div style={{ display: 'grid', gap: '8px' }}>
                {addresses.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAddressId(a.id)}
                    style={{
                      textAlign: 'left',
                      border: a.id === addressId ? `2px solid ${BRAND.green}` : `1px solid ${SURFACE.hairline}`,
                      background: a.id === addressId ? SURFACE.subtle : '#ffffff',
                      borderRadius: '14px',
                      padding: '12px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <Truck size={14} color={BRAND.green} />
                      <b style={{ fontSize: '13px' }}>{a.recipient}</b>
                      <span style={{ fontSize: '11.5px', color: BRAND.muted }}>{a.phone}</span>
                    </div>
                    <p style={{ margin: '5px 0 0', fontSize: '12px', lineHeight: 1.5, color: BRAND.muted, wordBreak: 'keep-all' }}>
                      ({a.postcode}) {a.address1} {a.address2 ?? ''}
                    </p>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowAddressForm(true)}
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: BRAND.green,
                    fontSize: '12.5px',
                    fontWeight: 800,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    padding: '4px',
                    justifySelf: 'start',
                  }}
                >
                  + 새 배송지 추가
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                <Field label="받는 분" value={form.recipient} onChange={(v) => setForm({ ...form, recipient: v })} />
                <Field label="연락처" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="010-0000-0000" />
                <Field label="우편번호" value={form.postcode} onChange={(v) => setForm({ ...form, postcode: v })} />
                <Field label="주소" value={form.address1} onChange={(v) => setForm({ ...form, address1: v })} />
                <Field label="상세 주소" value={form.address2} onChange={(v) => setForm({ ...form, address2: v })} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <CTA onClick={() => void saveAddress()} disabled={working} style={{ marginTop: '6px' }}>
                    배송지 저장
                  </CTA>
                  {addresses.length > 0 && (
                    <CTA variant="outline" onClick={closeAddressForm} style={{ marginTop: '6px' }}>
                      취소
                    </CTA>
                  )}
                </div>
              </div>
            )}
          </Card>

          {user && balance > 0 && (
            <Card>
              <SectionHeading kicker="적립금" title="적립금 사용" hint={`보유 ${krw(balance)}원`} />
              <input
                type="range"
                min={0}
                max={maxReward}
                step={10}
                value={applied}
                onChange={(e) => setUseReward(Number(e.target.value))}
                style={{ width: '100%', accentColor: BRAND.green }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: BRAND.muted }}>
                <span>0원</span>
                <b style={{ color: BRAND.green, fontSize: '13px' }}>{krw(applied)}원 사용</b>
                <span>{krw(maxReward)}원</span>
              </div>
            </Card>
          )}

          <Card>
            <SectionHeading kicker="결제" title="결제 금액" />
            <Row label="상품 금액" value={`${krw(subtotal)}원`} />
            {applied > 0 && <Row label="적립금 사용" value={`- ${krw(applied)}원`} accent />}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                borderTop: `1px solid ${SURFACE.hairline}`,
                marginTop: '10px',
                paddingTop: '12px',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 800 }}>최종 결제</span>
              <strong style={{ fontSize: '23px', fontWeight: 900, color: BRAND.green }}>{krw(total)}원</strong>
            </div>
            {cashback > 0 && (
              <p style={{ margin: '6px 0 0', fontSize: '12px', fontWeight: 800, color: BRAND.green, textAlign: 'right' }}>
                결제 후 {krw(cashback)}원 적립 예정
              </p>
            )}

            {billing?.devMode && (
              <p style={{ margin: '12px 0 0', fontSize: '11.5px', lineHeight: 1.6, color: '#7A5500', background: '#FFF8E8', border: '1px solid #F0DCA8', borderRadius: '12px', padding: '10px' }}>
                지금은 <b>테스트 결제</b>입니다. 실제로 돈이 빠져나가지 않습니다.
              </p>
            )}
            {!canPay && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <Info size={15} color={BRAND.muted} style={{ flexShrink: 0, marginTop: '1px' }} />
                <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.6, color: BRAND.muted, wordBreak: 'keep-all' }}>
                  {billing?.serverMissing
                    ? '결제 서버가 아직 연결되지 않았습니다.'
                    : '상품 결제 수단을 준비 중입니다. 담아두시면 준비 후 바로 결제하실 수 있어요.'}
                </p>
              </div>
            )}
            {error && (
              <p style={{ margin: '12px 0 0', fontSize: '12px', lineHeight: 1.6, color: '#8E3A32', background: '#FDF2F1', border: '1px solid #F3CFCB', borderRadius: '12px', padding: '10px' }}>
                {error}
              </p>
            )}

            <CTA onClick={() => void pay()} disabled={working || !canPay || !addressId}>
              {working ? '처리 중...' : canPay ? `${krw(total)}원 결제하기` : '결제 준비 중'}
            </CTA>
          </Card>
        </>
      )}
    </div>
  );
}

function QtyButton({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        width: '26px',
        height: '26px',
        borderRadius: '8px',
        border: `1px solid ${SURFACE.hairline}`,
        background: '#ffffff',
        color: BRAND.muted,
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '5px 0' }}>
      <span style={{ color: BRAND.muted, fontWeight: 700 }}>{label}</span>
      <span style={{ fontWeight: 800, color: accent ? BRAND.green : BRAND.text }}>{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ display: 'grid', gap: '5px' }}>
      <span style={{ fontSize: '11.5px', fontWeight: 900, color: BRAND.muted }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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
