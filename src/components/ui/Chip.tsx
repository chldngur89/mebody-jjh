/**
 * 시안의 알약형 요소들
 * .identity-badge{background:var(--green);color:white;padding:8px 13px;border-radius:999px;font-weight:800;font-size:13px}
 * .market-categories button{border:1px solid #dbe2da;background:#fff;border-radius:999px;padding:8px 11px}
 * .market-categories .active{background:var(--green);color:#fff;border-color:var(--green)}
 * .hint{font-size:11px;color:var(--muted);background:#eef2ec;border-radius:999px;padding:5px 8px}
 */
import type { ReactNode } from 'react';
import { BRAND, SURFACE } from '../../theme/brand';

export function Chip({
  children,
  tone = 'subtle',
  onClick,
}: {
  children: ReactNode;
  /** solid: 초록 채움 / subtle: 옅은 배경 / outline: 흰 바탕 테두리 / onGreen: 초록 카드 위 */
  tone?: 'solid' | 'subtle' | 'outline' | 'onGreen';
  onClick?: () => void;
}) {
  const map = {
    solid: { background: BRAND.green, color: '#ffffff', border: '1px solid transparent' },
    subtle: { background: SURFACE.subtle, color: BRAND.muted, border: '1px solid transparent' },
    outline: { background: '#ffffff', color: BRAND.text, border: '1px solid #DBE2DA' },
    onGreen: { background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid transparent' },
  }[tone];

  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        borderRadius: '999px',
        padding: '8px 13px',
        fontSize: '13px',
        fontWeight: 800,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        cursor: onClick ? 'pointer' : 'default',
        ...map,
      }}
    >
      {children}
    </Tag>
  );
}
