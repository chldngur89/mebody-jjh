/**
 * 마켓 탭 — 사용자가 준 시안(Mebody Market.dc.html, "1a 마켓 홈")의 구성.
 *
 *   배송지 헤더 · 검색바 · 프로모션 배너 · 카테고리 아이콘 그리드
 *   · 타임 특가(카운트다운) · 베스트 셀링 그리드
 *
 * 시안의 하단탭·장바구니 FAB 는 우리 셸의 TabBar 가 이미 담당하므로 넣지 않습니다.
 * 색·라운드·그림자는 기존 토큰만 씁니다(#004628 / #FAFAF0 / #fffef8 / radius 22) —
 * 시안도 같은 규칙으로 만들어졌습니다.
 *
 * 상품은 `products` 테이블에서 옵니다. 현재 3행뿐이라 시안의 카테고리 8개 중
 * **값이 있는 것만** 노출합니다. 없는 걸 있는 척하지 않습니다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Plus, Search, ShoppingCart } from 'lucide-react';
import { fetchStoreProducts, type StoreProduct } from '../../api/content';
import { addToCart, cartCount, onCartChange } from '../../lib/cart';
import { BRAND, BRAND_CARD_BORDER, BRAND_RADIUS, SURFACE } from '../../theme/brand';
import { Card, Chip, PageTitle } from '../ui';

/** 시안의 카테고리. label 은 시안 문구 그대로. */
const CATEGORIES: Array<{ key: string; label: string; icon: string }> = [
  { key: 'release', label: '셀프 이완', icon: '◍' },
  { key: 'strength', label: '근력 운동', icon: '⌾' },
  { key: 'stretch', label: '스트레칭', icon: '⟋' },
  { key: 'support', label: '보조 용품', icon: '◎' },
  { key: 'food', label: '보조 식품', icon: '◇' },
];

function formatPrice(price: number | null): string {
  return price === null ? '가격 준비 중' : `${price.toLocaleString('ko-KR')}원`;
}

/** 제품 이미지 자리. 실제 사진이 없으면 시안처럼 회색 판을 둡니다. */
function ProductImage({ url, height = 110 }: { url?: string; height?: number }) {
  return (
    <div
      style={{
        height: `${height}px`,
        background: SURFACE.placeholder,
        borderRadius: '14px',
        marginBottom: '10px',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
      }}
    >
      {url ? (
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ fontSize: '11px', color: '#B4C0B6' }}>제품 이미지</span>
      )}
    </div>
  );
}

export interface MarketScreenProps {
  /** 멤버십이면 구매 5% 적립 배지를 붙입니다 */
  isPaid?: boolean;
  bodyCode?: string;
  onOpenMembership?: () => void;
  onOpenCart?: () => void;
}

export function MarketScreen({ isPaid = false, bodyCode, onOpenMembership, onOpenCart }: MarketScreenProps) {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [inCart, setInCart] = useState(() => cartCount());
  /** 방금 담은 상품에 체크 표시를 잠깐 보여줍니다 */
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string | null>(() => { try { return sessionStorage.getItem('mebody:market-category'); } catch { return null; } });
  const [query, setQuery] = useState(() => { try { return sessionStorage.getItem('mebody:market-query') ?? ''; } catch { return ''; } });
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    try { sessionStorage.setItem('mebody:market-query', query); sessionStorage.setItem('mebody:market-category', active ?? ''); } catch { /* memory only */ }
  }, [query, active]);

  useEffect(() => onCartChange(() => setInCart(cartCount())), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetchStoreProducts({ throwOnError: true })
      .then((list) => {
        if (!cancelled) setProducts(list);
      })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  /** 상품이 실제로 있는 카테고리만 노출 */
  const availableCategories = useMemo(() => {
    const has = new Set(products.map((p) => p.category).filter(Boolean));
    return CATEGORIES.filter((c) => has.has(c.key));
  }, [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (active && p.category !== active) return false;
      if (!q) return true;
      return `${p.name} ${p.description}`.toLowerCase().includes(q);
    });
  }, [products, active, query]);

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <PageTitle eyebrow="MEBODY MARKET" title="마켓" lead="셀프케어와 운동에 필요한 도구를 한곳에서." />

      {/* 검색바 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: BRAND.card,
          border: BRAND_CARD_BORDER,
          borderRadius: '999px',
          padding: '11px 15px',
        }}
      >
        <Search size={16} color={BRAND.muted} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="필요한 관리 도구를 검색해보세요"
          style={{
            flex: 1,
            border: 0,
            outline: 'none',
            background: 'transparent',
            fontSize: '13px',
            color: BRAND.text,
            fontFamily: 'inherit',
            minWidth: 0,
          }}
        />
      </div>

      {/* 프로모션 배너 — 시안의 .market-hero */}
      <div
        style={{
          background: BRAND.green,
          color: '#ffffff',
          borderRadius: `${BRAND_RADIUS}px`,
          padding: '18px 18px 16px',
          boxShadow: '0 12px 30px rgba(0,70,40,0.20)',
        }}
      >
        <Chip tone="onGreen">{bodyCode ? `${bodyCode} 맞춤 추천` : '맞춤 추천'}</Chip>
        <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '12px 0 6px', lineHeight: 1.3, wordBreak: 'keep-all' }}>
          루틴에 필요한
          <br />
          관리 도구
        </h2>
        <p style={{ margin: 0, color: '#D9E6DE', fontSize: '13px', lineHeight: 1.6, wordBreak: 'keep-all' }}>
          {isPaid
            ? '멤버십이라 구매하시면 결제액의 5%가 적립됩니다.'
            : '멤버십에 가입하면 구매액의 5%가 적립됩니다.'}
        </p>
        {!isPaid && onOpenMembership && (
          <button
            type="button"
            onClick={onOpenMembership}
            style={{
              marginTop: '12px',
              border: 0,
              background: '#ffffff',
              color: BRAND.green,
              fontWeight: 900,
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '13px',
              fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            멤버십 보기 <ChevronRight size={15} />
          </button>
        )}
      </div>

      {/* 카테고리 아이콘 그리드 */}
      {availableCategories.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {[{ key: '', label: '전체', icon: '⋯' }, ...availableCategories].map((c) => {
            const on = (c.key || null) === active;
            return (
              <button
                key={c.key || 'all'}
                type="button"
                onClick={() => setActive(c.key || null)}
                style={{
                  background: on ? BRAND.green : BRAND.card,
                  border: on ? '1px solid transparent' : BRAND_CARD_BORDER,
                  borderRadius: '18px',
                  padding: '14px 6px 10px',
                  display: 'grid',
                  placeItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '12px',
                    background: on ? 'rgba(255,255,255,0.18)' : SURFACE.subtle,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '15px',
                    color: on ? '#ffffff' : BRAND.green,
                  }}
                >
                  {c.icon}
                </span>
                <small style={{ fontSize: '11px', fontWeight: 800, color: on ? '#ffffff' : BRAND.text }}>
                  {c.label}
                </small>
              </button>
            );
          })}
        </div>
      )}

      {/* 상품 그리드 — 시안의 베스트 셀링 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 2px 10px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
            {active ? CATEGORIES.find((c) => c.key === active)?.label : '전체 상품'}
          </h2>
          <small style={{ fontSize: '12px', color: BRAND.muted }}>{visible.length}개</small>
        </div>

        {loadError ? (<Card><p role="alert">상품을 불러오지 못했습니다.</p><button type="button" onClick={() => setAttempt((n) => n + 1)}>다시 시도</button></Card>) : loading ? (
          <Card>
            <p style={{ margin: 0, fontSize: '13px', color: BRAND.muted }}>상품을 불러오는 중...</p>
          </Card>
        ) : visible.length === 0 ? (
          <Card>
            <p style={{ margin: 0, fontSize: '13px', color: BRAND.muted }}>
              {query ? '검색 결과가 없습니다.' : '준비 중인 카테고리입니다.'}
            </p>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {visible.map((product) => {
              const cashback = isPaid && product.price ? Math.floor((product.price * 5) / 100) : 0;
              return (
                <article
                  key={product.id}
                  style={{
                    background: BRAND.card,
                    border: BRAND_CARD_BORDER,
                    borderRadius: `${BRAND_RADIUS}px`,
                    padding: '12px',
                    position: 'relative',
                  }}
                >
                  <ProductImage url={product.imageUrl || undefined} />
                  <small style={{ color: BRAND.muted, fontSize: '11px' }}>
                    {CATEGORIES.find((c) => c.key === product.category)?.label ?? 'MEBODY STORE'}
                  </small>
                  <h3 style={{ fontSize: '14px', margin: '5px 0', fontWeight: 800, wordBreak: 'keep-all' }}>
                    {product.name}
                  </h3>
                  <p style={{ fontSize: '11px', color: BRAND.muted, lineHeight: 1.5, minHeight: '34px', margin: 0, wordBreak: 'keep-all' }}>
                    {product.description}
                  </p>
                  <strong style={{ fontSize: '14px', color: BRAND.green, display: 'block', marginTop: '6px' }}>
                    {formatPrice(product.price)}
                  </strong>
                  {cashback > 0 && (
                    <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: 800, color: BRAND.green }}>
                      멤버십 {cashback.toLocaleString()}원 적립
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={product.price === null}
                    aria-label={`${product.name} 담기`}
                    title={product.price === null ? '가격 준비 중' : '장바구니에 담기'}
                    onClick={() => {
                      addToCart(product.id);
                      setJustAdded(product.id);
                      window.setTimeout(() => setJustAdded((id) => (id === product.id ? null : id)), 1200);
                    }}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      bottom: '10px',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      border: 0,
                      background: BRAND.green,
                      color: '#ffffff',
                      display: 'grid',
                      placeItems: 'center',
                      opacity: product.price === null ? 0.45 : 1,
                      cursor: product.price === null ? 'default' : 'pointer',
                    }}
                  >
                    {justAdded === product.id ? <Check size={15} /> : <Plus size={15} />}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {inCart > 0 && onOpenCart ? (
        <button
          type="button"
          onClick={onOpenCart}
          style={{
            border: 0,
            background: BRAND.green,
            color: '#ffffff',
            borderRadius: '14px',
            padding: '14px 16px',
            fontSize: '15px',
            fontWeight: 800,
            fontFamily: 'inherit',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <ShoppingCart size={17} /> 장바구니 {inCart}개 보기 <ChevronRight size={16} />
        </button>
      ) : (
        <p style={{ margin: 0, fontSize: '11px', lineHeight: 1.6, color: BRAND.muted, textAlign: 'center', wordBreak: 'keep-all' }}>
          담아두시면 장바구니에서 배송지와 적립금을 정하고 결제하실 수 있습니다.
        </p>
      )}
    </div>
  );
}
