/**
 * 축 표시용 테마.
 * 값은 Pilot V1 시안 토큰(src/theme/brand.ts)을 따릅니다.
 * ROLLBACK: 이전 민트 계열로 되돌리려면 git checkout main -- src/data/axisTheme.ts
 */
import { BRAND } from '../theme/brand'

export const AXIS_GREEN_THEME = {
  deep: BRAND.green,
  primary: BRAND.greenMid,
  mid: '#2D8A5C',
  soft: '#A8D5C0',
  surface: BRAND.mint,
  border: 'rgba(0, 70, 40, 0.14)',
  borderStrong: 'rgba(0, 70, 40, 0.30)',
  track: '#E5EBE5',
  text: BRAND.green,
  textSoft: BRAND.muted,
  introSurfaces: [
    `linear-gradient(135deg, ${BRAND.card} 0%, ${BRAND.mint} 100%)`,
    `linear-gradient(135deg, ${BRAND.card} 0%, ${BRAND.mint} 100%)`,
    `linear-gradient(135deg, #F3F6F1 0%, ${BRAND.mint} 100%)`,
    `linear-gradient(135deg, #EEF2ED 0%, ${BRAND.mint} 100%)`,
  ],
  cardSurfaces: [BRAND.card, '#F3F6F1', BRAND.mint, '#E5EBE5'],
} as const
