/**
 * 상품 상세.
 *
 * 이전에는 이 화면이 없었습니다. 마켓에서 상품을 눌러도 아무 일이 없고,
 * 카드 오른쪽 아래의 작은 `+` 만 조용히 장바구니에 담았습니다. 무엇을 사는지
 * 확인할 방법이 없는 채로 담기만 되는 상태였습니다.
 *
 * 화면에 넣은 값은 `products` 테이블에 **실제로 있는 것만** 입니다:
 * 이름 · 설명 · 가격 · 사진 · 카테고리. 재고·옵션·후기·배송일은 컬럼이 없으므로
 * 있는 척하지 않습니다. 대신 담은 뒤에 무슨 일이 일어나는지를 적어 둡니다.
 *
 * 가격은 표시용입니다. 실제 결제 금액은 주문할 때 서버의 create_order 가
 * 상품 테이블을 다시 읽어 정합니다(lib/cart.ts 주석과 같은 이유).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ShoppingCart } from 'lucide-react';
import { fetchStoreProduct, type StoreProduct } from '../../api/content';
import { addToCart, cartCount, onCartChange, readCart } from '../../lib/cart';
import { BRAND, BRAND_CARD_BORDER, BRAND_RADIUS, SURFACE } from '../../theme/brand';
import { Card, CTA } from '../ui';

/** 마켓과 같은 카테고리 사전. 키가 비거나 모르는 값이면 스토어 이름을 씁니다. */
const CATEGORY_LABELS: Record<string, string> = {
  release: '셀프 이완',
  strength: '근력 운동',
  stretch: '스트레칭',
  support: '보조 용품',
  food: '보조 식품',
};

export interface ProductDetailScreenProps {
  productId: string;
  /** 멤버십이면 구매 5% 적립 */
  isPaid?: boolean;
  onBack: () => void;
  onOpenCart?: () => void;
  onOpenMembership?: () => void;
}

export function ProductDetailScreen({
  productId,
  isPaid = false,
  onBack,
  onOpenCart,
  onOpenMembership,
}: ProductDetailScreenProps) {
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [cartTotal, setCartTotal] = useState(() => cartCount());
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    let alive = true;
    setState('loading');
    fetchStoreProduct(productId)
      .then((row) => {
        if (!alive) return;
        setProduct(row);
        setState(row ? 'ready' : 'missing');
      })
      .catch(() => {
        if (alive) setState('error');
      });
    return () => {
      alive = false;
    };
  }, [productId, attempt]);

  useEffect(() => onCartChange(() => setCartTotal(cartCount())), []);

  /** 이 상품이 장바구니에 몇 개 있는지 — 담기 버튼 아래에 사실만 적습니다. */
  const inCartQty = useMemo(
    () => readCart().find((line) => line.productId === productId)?.quantity ?? 0,
    [productId, cartTotal],
  );

  const add = useCallback(() => {
    addToCart(productId);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1600);
  }, [productId]);

  const back = (
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
        fontSize: '0.8125rem',
        fontWeight: 800,
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      <ArrowLeft size={15} /> 마켓으로
    </button>
  );

  if (state !== 'ready' || !product) {
    return (
      <div style={{ display: 'grid', gap: '14px' }}>
        {back}
        <Card>
          {state === 'loading' ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: BRAND.muted }}>상품을 불러오는 중...</p>
          ) : state === 'missing' ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: BRAND.muted, wordBreak: 'keep-all' }}>
              지금은 판매하지 않는 상품입니다. 마켓에서 다른 상품을 살펴보세요.
            </p>
          ) : (
            <>
              <p role="alert" style={{ margin: '0 0 12px', fontSize: '0.8125rem', wordBreak: 'keep-all' }}>
                상품을 불러오지 못했습니다. 잠시 뒤 다시 시도해주세요.
              </p>
              <CTA variant="outline" onClick={() => setAttempt((n) => n + 1)} style={{ marginTop: 0 }}>
                다시 시도
              </CTA>
            </>
          )}
        </Card>
      </div>
    );
  }

  const categoryLabel = CATEGORY_LABELS[product.category] ?? 'mebody 스토어';
  const cashback = product.price ? Math.floor((product.price * 5) / 100) : 0;
  const soldOut = product.price === null;

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      {back}

      {/* 사진 — 목록의 110px 썸네일과 달리 여기서는 상품을 보러 온 것이므로 크게 둡니다 */}
      <div
        style={{
          height: '260px',
          background: SURFACE.placeholder,
          borderRadius: `${BRAND_RADIUS}px`,
          border: BRAND_CARD_BORDER,
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
        }}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ fontSize: '0.8125rem', color: 'var(--mebody-t-b4c0b6, #B4C0B6)' }}>제품 이미지</span>
        )}
      </div>

      <div style={{ display: 'grid', gap: '6px' }}>
        <small style={{ fontSize: '0.75rem', fontWeight: 800, color: BRAND.muted }}>{categoryLabel}</small>
        <h1
          style={{
            margin: 0,
            fontSize: '1.25rem',
            fontWeight: 800,
            lineHeight: 1.35,
            color: BRAND.text,
            wordBreak: 'keep-all',
          }}
        >
          {product.name}
        </h1>
        <strong style={{ fontSize: '1.375rem', fontWeight: 800, color: BRAND.green }}>
          {soldOut ? '가격 준비 중' : `${product.price!.toLocaleString('ko-KR')}원`}
        </strong>
      </div>

      {/* 멤버십 적립 — 회원에게는 금액을, 비회원에게는 가입 경로를 */}
      {!soldOut && (isPaid ? (
        <div
          style={{
            borderRadius: '14px',
            background: SURFACE.subtle,
            padding: '12px 14px',
            fontSize: '0.8125rem',
            fontWeight: 800,
            color: BRAND.green,
          }}
        >
          멤버십 적립 {cashback.toLocaleString('ko-KR')}원 (구매 금액의 5%)
        </div>
      ) : onOpenMembership ? (
        <button
          type="button"
          onClick={onOpenMembership}
          style={{
            textAlign: 'left',
            borderRadius: '14px',
            background: SURFACE.subtle,
            border: 0,
            padding: '12px 14px',
            fontSize: '0.8125rem',
            fontWeight: 800,
            color: BRAND.green,
            fontFamily: 'inherit',
            cursor: 'pointer',
            minHeight: '44px',
            wordBreak: 'keep-all',
          }}
        >
          멤버십이면 {cashback.toLocaleString('ko-KR')}원이 적립됩니다 · 멤버십 알아보기
        </button>
      ) : null)}

      <Card>
        <h2 style={{ margin: '0 0 8px', fontSize: '0.9375rem', fontWeight: 800, color: BRAND.text }}>
          상품 설명
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            lineHeight: 1.7,
            color: BRAND.text,
            whiteSpace: 'pre-line',
            wordBreak: 'keep-all',
          }}
        >
          {product.description || '설명이 준비되는 중입니다.'}
        </p>
      </Card>

      <div>
        <CTA onClick={add} disabled={soldOut} style={{ marginTop: 0 }}>
          {justAdded ? (
            <>
              <Check size={17} /> 장바구니에 담았습니다
            </>
          ) : (
            <>
              <ShoppingCart size={17} /> {soldOut ? '가격 준비 중' : '장바구니에 담기'}
            </>
          )}
        </CTA>

        {/* 담았다는 사실은 버튼 글씨만으로는 스크린리더에 전해지지 않습니다 */}
        <p role="status" aria-live="polite" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', margin: '-1px' }}>
          {justAdded ? `${product.name} 1개를 장바구니에 담았습니다. 현재 ${inCartQty}개.` : ''}
        </p>

        {inCartQty > 0 && onOpenCart && (
          <CTA variant="outline" onClick={onOpenCart} style={{ marginTop: '10px' }}>
            장바구니 {cartTotal}개 보기 (이 상품 {inCartQty}개)
          </CTA>
        )}
      </div>

      <p
        style={{
          margin: 0,
          fontSize: '0.75rem',
          lineHeight: 1.6,
          color: BRAND.muted,
          textAlign: 'center',
          wordBreak: 'keep-all',
        }}
      >
        배송지와 적립금 사용은 장바구니에서 정합니다. 결제 금액은 주문할 때 다시 계산됩니다.
      </p>
    </div>
  );
}
