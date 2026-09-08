/**
 * 시안의 .section-heading — 01~04 번호 + 제목 + 우측 힌트 알약
 *
 * .section-number{font-size:11px;font-weight:900;color:var(--green);letter-spacing:.08em}
 * .section-heading h2{font-size:20px;letter-spacing:-.4px}
 * .hint{font-size:11px;color:var(--muted);background:#eef2ec;border-radius:999px;padding:5px 8px}
 */
import type { ReactNode } from 'react';
import { BRAND, SURFACE, TYPE } from '../../theme/brand';

export function SectionHeading({
  kicker,
  title,
  hint,
  inverse = false,
}: {
  /**
   * 이 섹션이 어디로 이어지는지 알려주는 작은 소제목.
   * 01/02 같은 번호 대신 '미션' '루틴' '마켓' '내 상태' 처럼 목적지를 씁니다.
   */
  kicker?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  /** 초록 카드 위에 올릴 때 */
  inverse?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '18px' }}>
      <div style={{ minWidth: 0 }}>
        {kicker && (
          <div style={{ ...TYPE.sectionNumber, color: inverse ? 'rgba(255,255,255,.78)' : BRAND.green, marginBottom: '6px' }}>
            {kicker}
          </div>
        )}
        <h2 style={{ ...TYPE.sectionTitle, margin: 0, fontWeight: 800, color: inverse ? '#ffffff' : BRAND.text, wordBreak: 'keep-all' }}>
          {title}
        </h2>
      </div>
      {hint && (
        <span style={{ flexShrink: 0, fontSize: '11px', color: BRAND.muted, background: SURFACE.subtle, borderRadius: '999px', padding: '5px 8px' }}>
          {hint}
        </span>
      )}
    </div>
  );
}
