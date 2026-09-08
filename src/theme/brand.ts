/**
 * MEBODY 브랜드 팔레트
 *
 * Pilot V1 결과페이지 시안(mebody_V1_routine_timeline_reward.html)의 CSS 변수를 정본으로 삼습니다.
 * 시안 → 코드 대응
 *   --bg #FAFAF0 · --card #fffef8 · --green #004628 · --green2 #0d5b3c
 *   --mint #e9f1e9 · --line #d8ded6 · --text #183126 · --muted #6d7b73
 *   --shadow 0 12px 34px rgba(0,70,40,.08) · --radius 22px
 *
 * ROLLBACK: git checkout main -- src/theme/brand.ts src/data/axisTheme.ts
 */
export const BRAND = {
  /** 페이지 배경. 시안은 단색 크림이며 그라데이션을 쓰지 않습니다. */
  bg: '#FAFAF0',
  /** 카드 표면 */
  card: '#FFFEF8',
  green: '#004628',
  greenMid: '#0D5B3C',
  mint: '#E9F1E9',
  line: '#D8DED6',
  text: '#183126',
  muted: '#6D7B73',
  /** 이전 팔레트 호환용 별칭 */
  cream: '#FFFEF8',
  greenSoft: '#E9F1E9',
  greenMuted: '#A8D5C0',
} as const

export const BRAND_RADIUS = 22
export const BRAND_SHADOW = '0 12px 34px rgba(0,70,40,0.08)'
export const BRAND_SHADOW_STRONG = '0 18px 44px rgba(0,70,40,0.12)'
export const BRAND_GRADIENT_90 = `linear-gradient(90deg, ${BRAND.green} 0%, ${BRAND.greenMid} 100%)`
export const BRAND_GRADIENT_135 = `linear-gradient(135deg, ${BRAND.green} 0%, ${BRAND.greenMid} 100%)`

/** 화면 배경. 시안과 동일하게 단색입니다. */
export const BRAND_PAGE_BG = BRAND.bg

// ---------------------------------------------------------------------------
// 시안 CSS 를 1:1 로 옮긴 값들.
// 색만 맞추고 컴포넌트를 그대로 두면 인상이 달라지지 않아, 형태값까지 정본화합니다.
// ---------------------------------------------------------------------------

/** 카드 테두리. 시안은 회색 선이 아니라 "옅은 초록"입니다. */
export const BRAND_CARD_BORDER = '1px solid rgba(0, 70, 40, 0.08)'

/** 셸 — .app-shell / body */
export const SHELL = {
  /** .app-shell width: min(430px, 100%) */
  maxWidth: 430,
  /** 셸 바깥 배경 (body) */
  outerBg: '#EEF1EC',
  /** .topbar height */
  topBarHeight: 58,
  /** .bottom-nav height */
  tabBarHeight: 72,
  topBarBg: 'rgba(250, 250, 240, 0.95)',
  topBarBorder: '1px solid rgba(0, 70, 40, 0.06)',
  tabBarBg: 'rgba(255, 255, 250, 0.97)',
  tabBarBorder: '1px solid #DFE5DF',
  /** .bottom-nav button 기본색 */
  tabInactive: '#748179',
} as const

/** 타이포 — 시안의 실제 수치 */
export const TYPE = {
  /** 시안 폰트. SUIT 대신 이걸 씁니다(사용자 지시: HTML 과 동일하게). */
  family: 'Arial, "Noto Sans KR", sans-serif',
  /** .intro h1 */
  heroTitle: { fontSize: '42px', lineHeight: 1, letterSpacing: '-1px' },
  /** .simple-page > h1 */
  pageTitle: { fontSize: '34px', lineHeight: 1, letterSpacing: '-1px' },
  /** .section-heading h2 */
  sectionTitle: { fontSize: '20px', letterSpacing: '-0.4px' },
  /** .eyebrow */
  eyebrow: {
    fontSize: '12px',
    letterSpacing: '0.12em',
    fontWeight: 800,
    color: '#688072',
    textTransform: 'uppercase' as const,
  },
  /** .section-number */
  sectionNumber: { fontSize: '11px', fontWeight: 900, letterSpacing: '0.08em' },
  /** .lead */
  lead: { lineHeight: 1.55 },
} as const

/** 게이지 — .track / .status-exp-track */
export const GAUGE = {
  /** .track background */
  trackBg: '#E6EBE5',
  /** .status-exp-track background */
  progressBg: '#E2E9E2',
  /** .track:after 중앙 눈금 */
  tickColor: '#B9C6BD',
  height: 8,
  /** .track i 손잡이 */
  knobSize: 16,
} as const

/** 보조 표면색 — 시안에서 반복적으로 쓰이는 옅은 초록 회색들 */
export const SURFACE = {
  /** .hint / .info-note / .day-dot i */
  subtle: '#EEF2EC',
  /** .weekly-reward */
  soft: '#F0F4EF',
  /** .posture-illust / .product-image */
  placeholder: '#EFF2ED',
  /** .posture-scroll article border */
  hairline: '#E1E6DF',
} as const
