/**
 * 시안의 .cta / .cta.light
 * .cta{border:0;background:var(--green);color:#fff;font-weight:800;border-radius:14px;padding:14px 16px;width:100%;margin-top:16px}
 * .cta.light{background:#fff;color:var(--green)}
 *
 * 지금 앱은 여기저기 54px 높이 + 16px 반경 + 그라데이션을 쓰고 있었습니다.
 * 시안은 단색 초록 + 14px 반경 + padding 기반입니다.
 */
import type { CSSProperties, ReactNode } from 'react';
import { BRAND } from '../../theme/brand';

export function CTA({
  children,
  onClick,
  variant = 'solid',
  disabled = false,
  style,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  /** solid: 초록 채움 / light: 흰 바탕 초록 글씨(초록 카드 위) / outline: 흰 바탕 초록 테두리 */
  variant?: 'solid' | 'light' | 'outline';
  disabled?: boolean;
  style?: CSSProperties;
  type?: 'button' | 'submit';
}) {
  const base: CSSProperties = {
    border: 0,
    borderRadius: '14px',
    padding: '14px 16px',
    width: '100%',
    marginTop: '16px',
    fontWeight: 800,
    fontSize: '15px',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.55 : 1,
  };
  const tone: CSSProperties =
    variant === 'light'
      ? { background: '#ffffff', color: BRAND.green }
      : variant === 'outline'
        ? { background: '#ffffff', color: BRAND.green, border: `1px solid ${BRAND.green}` }
        : { background: BRAND.green, color: '#ffffff' };

  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...tone, ...style }}>
      {children}
    </button>
  );
}

/** 시안의 .text-link — "결과 자세히 보기 →" 류 */
export function TextLink({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 0,
        background: 'transparent',
        padding: '8px 0 0',
        color: BRAND.green,
        fontWeight: 800,
        fontSize: '13px',
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
