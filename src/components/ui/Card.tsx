/**
 * 시안의 .section-card / .hero-card
 *
 * .hero-card,.section-card,...{background:var(--card);border:1px solid rgba(0,70,40,.08);
 *   border-radius:var(--radius);box-shadow:var(--shadow)}
 * .section-card{padding:20px;margin:14px 0}
 *
 * 지금 앱의 카드는 반투명 흰색 + backdrop blur + 푸른 회색 그림자였습니다.
 * 시안은 불투명 크림 + 초록 그림자이고, 이 차이가 전체 인상을 가릅니다.
 */
import type { CSSProperties, ReactNode } from 'react';
import { BRAND, BRAND_CARD_BORDER, BRAND_RADIUS, BRAND_SHADOW } from '../../theme/brand';

export interface CardProps {
  children: ReactNode;
  /** 초록 배경 카드(.direction-card, .market-hero) */
  tone?: 'default' | 'green';
  padding?: string;
  style?: CSSProperties;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, tone = 'default', padding = '20px', style, className, onClick }: CardProps) {
  const green = tone === 'green';
  return (
    <section
      className={className}
      onClick={onClick}
      style={{
        background: green ? BRAND.green : BRAND.card,
        border: green ? '1px solid transparent' : BRAND_CARD_BORDER,
        borderRadius: `${BRAND_RADIUS}px`,
        boxShadow: green ? 'none' : BRAND_SHADOW,
        color: green ? '#ffffff' : BRAND.text,
        padding,
        ...style,
      }}
    >
      {children}
    </section>
  );
}
