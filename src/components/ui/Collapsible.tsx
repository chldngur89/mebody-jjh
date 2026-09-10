/**
 * 접이식 섹션.
 *
 * 내 상태 화면에 프로필·주문·멤버십·측정 기록이 더 붙으면서 카드가 열 장을 넘었습니다.
 * 전부 펼쳐 두면 아래쪽 항목까지 스크롤이 너무 길어져, 자주 보는 것만 펼쳐 둡니다.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { BRAND, BRAND_CARD_BORDER, BRAND_RADIUS, BRAND_SHADOW, SURFACE } from '../../theme/brand';

const DANGER = {
  border: '1px solid rgba(185, 58, 50, 0.42)',
  background: '#FDF2F1',
  kicker: '#8E3A32',
  hintBg: '#F8E0DD',
  hintColor: '#8E3A32',
  shadow: '0 12px 34px rgba(142, 58, 50, 0.08)',
} as const;

export function Collapsible({
  kicker,
  title,
  hint,
  children,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  tone = 'default',
  dense = false,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** 지정하면 제어 컴포넌트로 동작합니다. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  tone?: 'default' | 'danger';
  /** 폼처럼 내용이 많을 때 패딩·타이포를 조금 줄입니다. */
  dense?: boolean;
}) {
  const controlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlled ? openProp : uncontrolledOpen;

  useEffect(() => {
    if (!controlled) setUncontrolledOpen(defaultOpen);
  }, [controlled, defaultOpen]);

  const setOpen = (next: boolean) => {
    if (!controlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const danger = tone === 'danger';
  const headerPad = dense ? '14px 16px' : '18px 20px';
  const bodyPad = dense ? '0 16px 16px' : '0 20px 20px';

  return (
    <section
      style={{
        background: danger ? DANGER.background : BRAND.card,
        border: danger ? DANGER.border : BRAND_CARD_BORDER,
        borderRadius: `${BRAND_RADIUS}px`,
        boxShadow: danger ? DANGER.shadow : BRAND_SHADOW,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          width: '100%',
          border: 0,
          background: 'transparent',
          padding: headerPad,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
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
                fontSize: dense ? '10px' : '11px',
                fontWeight: 900,
                color: danger ? DANGER.kicker : BRAND.green,
                letterSpacing: '0.08em',
                marginBottom: dense ? '2px' : '4px',
              }}
            >
              {kicker}
            </span>
          )}
          <span
            style={{
              display: 'block',
              fontSize: dense ? '15px' : '17px',
              fontWeight: 800,
              letterSpacing: '-0.3px',
              color: danger ? DANGER.kicker : undefined,
            }}
          >
            {title}
          </span>
        </span>
        {hint && (
          <span
            style={{
              fontSize: dense ? '10px' : '11px',
              color: danger ? DANGER.hintColor : BRAND.muted,
              background: danger ? DANGER.hintBg : SURFACE.subtle,
              borderRadius: '999px',
              padding: dense ? '4px 8px' : '5px 9px',
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {hint}
          </span>
        )}
        <ChevronDown
          size={dense ? 16 : 17}
          color={danger ? DANGER.kicker : BRAND.muted}
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}
        />
      </button>
      {open && <div style={{ padding: bodyPad }}>{children}</div>}
    </section>
  );
}
