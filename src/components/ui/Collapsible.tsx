/**
 * 접이식 섹션.
 *
 * 내 상태 화면에 프로필·주문·멤버십·측정 기록이 더 붙으면서 카드가 열 장을 넘었습니다.
 * 전부 펼쳐 두면 아래쪽 항목까지 스크롤이 너무 길어져, 자주 보는 것만 펼쳐 둡니다.
 */
import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { BRAND, BRAND_CARD_BORDER, BRAND_RADIUS, BRAND_SHADOW, SURFACE } from '../../theme/brand';

export function Collapsible({
  kicker,
  title,
  hint,
  children,
  defaultOpen = false,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      style={{
        background: BRAND.card,
        border: BRAND_CARD_BORDER,
        borderRadius: `${BRAND_RADIUS}px`,
        boxShadow: BRAND_SHADOW,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          border: 0,
          background: 'transparent',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          {kicker && (
            <span
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 900,
                color: BRAND.green,
                letterSpacing: '0.08em',
                marginBottom: '4px',
              }}
            >
              {kicker}
            </span>
          )}
          <span style={{ display: 'block', fontSize: '17px', fontWeight: 800, letterSpacing: '-0.3px' }}>{title}</span>
        </span>
        {hint && (
          <span
            style={{
              fontSize: '11px',
              color: BRAND.muted,
              background: SURFACE.subtle,
              borderRadius: '999px',
              padding: '5px 9px',
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {hint}
          </span>
        )}
        <ChevronDown
          size={17}
          color={BRAND.muted}
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}
        />
      </button>
      {open && <div style={{ padding: '0 20px 20px' }}>{children}</div>}
    </section>
  );
}
