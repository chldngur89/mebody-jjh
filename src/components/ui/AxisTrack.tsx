/**
 * 시안의 .axis-row 게이지
 *
 * .axis-row{display:grid;grid-template-columns:48px 1fr;gap:10px;align-items:end}
 * .labels{display:flex;justify-content:space-between;font-size:12px;color:#5f6e65;margin-bottom:7px}
 * .track{height:8px;border-radius:999px;background:#e6ebe5;position:relative}
 * .track:after{중앙 세로 눈금 1px #b9c6bd}
 * .track i{16px 원, 초록, 3px 흰 테두리, 그림자}
 *
 * 지금 앱은 좌우 50% 분할 바 + 퍼센트 숫자였습니다. 시안은 "한 점이 어느 쪽으로 치우쳤나"를
 * 보여주는 방식이라 정보 전달이 다릅니다.
 */
import { BRAND, GAUGE } from '../../theme/brand';

export function AxisTrack({
  label,
  leftLabel,
  rightLabel,
  /** 0~100. 50 이 중앙입니다. */
  value,
}: {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr', gap: '10px', alignItems: 'end' }}>
      <b style={{ fontSize: '14px', color: BRAND.text }}>{label}</b>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#5F6E65', marginBottom: '7px' }}>
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
        <div style={{ height: `${GAUGE.height}px`, borderRadius: '999px', background: GAUGE.trackBg, position: 'relative' }}>
          {/* 중앙 눈금 */}
          <span style={{ position: 'absolute', left: '50%', top: '-4px', bottom: '-4px', width: '1px', background: GAUGE.tickColor }} />
          {/* 손잡이 */}
          <i
            style={{
              position: 'absolute',
              left: `${clamped}%`,
              top: '50%',
              width: `${GAUGE.knobSize}px`,
              height: `${GAUGE.knobSize}px`,
              background: BRAND.green,
              border: '3px solid #ffffff',
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 1px 7px rgba(0,70,40,.22)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
