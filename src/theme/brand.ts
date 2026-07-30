/**
 * MEBODY brand palette (2026).
 * ROLLBACK: restore previous emerald/teal hexes, or `git checkout main -- src/`
 */
export const BRAND = {
  cream: '#FFFFF3',
  green: '#014725',
  greenMid: '#016B38',
  greenSoft: '#E8F5EE',
  greenMuted: '#A8D5C0',
} as const

export const BRAND_GRADIENT_90 = `linear-gradient(90deg, ${BRAND.green} 0%, ${BRAND.greenMid} 100%)`
export const BRAND_GRADIENT_135 = `linear-gradient(135deg, ${BRAND.green} 0%, ${BRAND.greenMid} 100%)`
export const BRAND_SHADOW = '0 14px 30px rgba(1,71,37,0.28)'
