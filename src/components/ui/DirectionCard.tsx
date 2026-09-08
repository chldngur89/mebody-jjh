/**
 * 시안의 .direction-card — 초록 배경 + 흰 숫자 원 + 목록
 * .direction-card{background:var(--green);color:white;border-radius:22px;padding:20px}
 * .direction-card li>span{26px 원, 흰 배경, 초록 글씨, weight 900}
 * .direction-card p{color:rgba(255,255,255,.75);font-size:12px}
 */
import type { ReactNode } from 'react';
import { BRAND, BRAND_RADIUS } from '../../theme/brand';

export interface DirectionStep {
  title: ReactNode;
  desc?: ReactNode;
}

export function DirectionCard({
  kicker,
  title,
  steps,
  action,
}: {
  /** 이 섹션이 이어지는 목적지 */
  kicker?: ReactNode;
  title: ReactNode;
  steps: DirectionStep[];
  action?: ReactNode;
}) {
  return (
    <section style={{ background: BRAND.green, color: '#ffffff', borderRadius: `${BRAND_RADIUS}px`, padding: '20px' }}>
      {kicker && (
        <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.08em', color: 'rgba(255,255,255,.78)', marginBottom: '6px' }}>
          {kicker}
        </div>
      )}
      <h2 style={{ fontSize: '20px', letterSpacing: '-0.4px', fontWeight: 800, margin: '6px 0 0', wordBreak: 'keep-all' }}>{title}</h2>
      <ol style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
        {steps.map((step, index) => (
          <li key={index} style={{ display: 'flex', gap: '11px', margin: '13px 0' }}>
            <span
              style={{
                flexShrink: 0,
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: '#ffffff',
                color: BRAND.green,
                display: 'grid',
                placeItems: 'center',
                fontWeight: 900,
                fontSize: '13px',
              }}
            >
              {index + 1}
            </span>
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: '15px', wordBreak: 'keep-all' }}>{step.title}</b>
              {step.desc && (
                <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,.75)', fontSize: '12px', lineHeight: 1.5, wordBreak: 'keep-all' }}>
                  {step.desc}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {action}
    </section>
  );
}
