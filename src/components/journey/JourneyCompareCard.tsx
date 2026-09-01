/**
 * 재측정 전후 비교 카드 (Intro · Next 공용)
 *
 * 의료 판단이 아니라 경향 차이의 변화만 중립적으로 보여줍니다.
 */

import { ArrowRight, Minus, TrendingDown, TrendingUp, Shuffle } from 'lucide-react'
import { AXIS_GREEN_THEME } from '../../data/axisTheme'
import type { CompareTrend, JourneyComparison } from '../../utils/journeyCompare'

const TREND_ICON: Record<CompareTrend, typeof Minus> = {
  narrowed: TrendingDown,
  widened: TrendingUp,
  similar: Minus,
  flipped: Shuffle,
}

const TREND_COLOR: Record<CompareTrend, string> = {
  narrowed: '#014725',
  widened: '#92400e',
  similar: '#6b7280',
  flipped: '#1d4ed8',
}

export function JourneyCompareCard({ comparison }: { comparison: JourneyComparison }) {
  return (
    <section
      style={{
        borderRadius: '24px',
        border: `1px solid ${AXIS_GREEN_THEME.borderStrong}`,
        background: 'linear-gradient(135deg, rgba(232,245,238,0.96) 0%, rgba(255,255,255,0.98) 100%)',
        padding: '20px 18px',
      }}
    >
      <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.16em', color: '#014725', marginBottom: '10px' }}>
        RE-CHECK
      </div>
      <h2 style={{ fontSize: '19px', fontWeight: 900, color: '#111827', marginBottom: '14px' }}>재측정 전후 비교</h2>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          borderRadius: '18px',
          background: 'rgba(255,255,255,0.9)',
          border: `1px solid ${AXIS_GREEN_THEME.border}`,
          padding: '16px',
          marginBottom: '14px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 900, color: '#7c8794', marginBottom: '4px' }}>이전</div>
          <div style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '-0.03em', color: '#6b7280' }}>
            {comparison.beforeCode || '----'}
          </div>
        </div>
        <ArrowRight size={20} color="#014725" />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 900, color: '#014725', marginBottom: '4px' }}>지금</div>
          <div style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '-0.03em', color: '#111827' }}>
            {comparison.afterCode || '----'}
          </div>
        </div>
      </div>

      <div
        style={{
          borderRadius: '16px',
          background: 'rgba(228,244,240,0.9)',
          border: `1px solid ${AXIS_GREEN_THEME.border}`,
          padding: '13px 15px',
          fontSize: '13px',
          lineHeight: 1.7,
          fontWeight: 700,
          color: '#014725',
          wordBreak: 'keep-all',
          marginBottom: '14px',
        }}
      >
        {comparison.summary}
      </div>

      <div style={{ display: 'grid', gap: '10px' }}>
        {comparison.axes.map((axis) => {
          const Icon = TREND_ICON[axis.trend]
          return (
            <div
              key={axis.axis}
              style={{
                display: 'grid',
                gridTemplateColumns: '20px 1fr auto',
                alignItems: 'center',
                gap: '11px',
                borderRadius: '14px',
                background: '#ffffff',
                border: `1px solid ${AXIS_GREEN_THEME.border}`,
                padding: '13px 14px',
              }}
            >
              <Icon size={18} color={TREND_COLOR[axis.trend]} />
              <div style={{ minWidth: 0, fontSize: '13px', lineHeight: 1.55, color: '#374151', wordBreak: 'keep-all' }}>
                {axis.message}
              </div>
              <div style={{ flexShrink: 0, fontSize: '12px', fontWeight: 800, color: '#7c8794', fontVariantNumeric: 'tabular-nums' }}>
                {axis.beforeWinner} {axis.beforePercent}% → {axis.afterWinner} {axis.afterPercent}%
              </div>
            </div>
          )
        })}
      </div>

      {comparison.identityChanged && (
        <div
          style={{
            marginTop: '12px',
            borderRadius: '14px',
            background: 'rgba(255,255,255,0.9)',
            border: `1px solid ${AXIS_GREEN_THEME.border}`,
            padding: '13px 14px',
            fontSize: '13px',
            lineHeight: 1.6,
            color: '#374151',
            wordBreak: 'keep-all',
          }}
        >
          아이덴티티가 <strong style={{ color: '#6b7280' }}>{comparison.identityBefore}</strong>에서{' '}
          <strong style={{ color: '#014725' }}>{comparison.identityAfter}</strong>으로 바뀌었습니다.
        </div>
      )}

      <div style={{ marginTop: '12px', fontSize: '11px', lineHeight: 1.6, color: '#9ca3af', wordBreak: 'keep-all' }}>
        이 비교는 셀프 체크 응답의 변화이며 의료 진단이나 치료 효과 판정이 아닙니다. 통증이 지속되면 의료 전문가의 판단을 우선해 주세요.
      </div>
    </section>
  )
}
