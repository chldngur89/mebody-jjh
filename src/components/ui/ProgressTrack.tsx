/**
 * 시안의 .status-exp-track — 사용자가 "그래프 바도 html 처럼" 이라고 한 그것.
 * .status-exp-track{height:8px;background:#e2e9e2;border-radius:999px;overflow:hidden}
 * .status-exp-track i{background:#004628;border-radius:999px}
 */
import type { ReactNode } from 'react';
import { BRAND, GAUGE } from '../../theme/brand';

export function ProgressTrack({
  percent,
  label,
  value,
  foot,
}: {
  percent: number;
  /** 좌측 라벨 (.status-exp-label b) */
  label?: ReactNode;
  /** 우측 값 */
  value?: ReactNode;
  /** 하단 우측 보조문 (.status-exp-next) */
  foot?: ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div style={{ width: '100%', marginTop: '14px' }}>
      {(label || value) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#748079' }}>
          <b style={{ color: BRAND.green }}>{label}</b>
          <span>{value}</span>
        </div>
      )}
      <div style={{ height: `${GAUGE.height}px`, background: GAUGE.progressBg, borderRadius: '999px', marginTop: '6px', overflow: 'hidden' }}>
        <i style={{ display: 'block', width: `${clamped}%`, height: '100%', background: BRAND.green, borderRadius: '999px', transition: 'width 260ms ease' }} />
      </div>
      {foot && <div style={{ marginTop: '5px', textAlign: 'right', fontSize: '10px', color: '#8A938D' }}>{foot}</div>}
    </div>
  );
}
