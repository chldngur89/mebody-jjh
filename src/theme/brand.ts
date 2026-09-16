/**
 * mebody 브랜드 팔레트
 *
 * 정본은 홈페이지(mebody-server/assets/landing.css)의 팔레트입니다.
 * 이전에는 Pilot V1 시안(mebody_V1_routine_timeline_reward.html)을 따랐는데,
 * 홈페이지와 본문색·뮤티드가 갈라져 두 화면의 인상이 달랐습니다.
 * 또한 muted(#6D7B73) 는 4.23:1 로 작은 글씨 대비 미달이었습니다.
 * 홈페이지 → 앱 대응
 *   --mb-cream #FFFFF3 → bg · --mb-green #014725 → green·text
 *   --mb-green-2 #016B38 → greenMid · --mb-ink-70 #3D6B54 · --mb-ink-60 #4A6B58
 *   --mb-ink-50 #587761 → muted · --shadow 0 12px 34px rgba(1,71,37,.08) · --radius 22px
 *
 * ROLLBACK: git checkout main -- src/theme/brand.ts src/data/axisTheme.ts
 */
export const BRAND = {
  /** 페이지 배경 — 홈페이지 --mb-cream 과 동일. 단색, 그라데이션 없음. */
  bg: '#FFFFF3',
  /** 카드 표면 — 크림 위에서 한 단계 떠 보이게 */
  card: '#FFFFFF',
  /** 홈페이지 --mb-green. 10.81:1 */
  green: '#014725',
  /** 홈페이지 --mb-green-2. 6.60:1 */
  greenMid: '#016B38',
  mint: '#E8F3EC',
  /** 홈페이지 --mb-line 을 크림 위에 합성한 값 */
  line: '#E1E9DA',
  /** 본문 — 홈페이지는 브랜드 그린을 본문색으로 쓴다. 10.81:1 */
  text: '#014725',
  /** 홈페이지 --mb-ink-50. 4.93:1 (이전 #6D7B73 은 4.23 으로 미달) */
  muted: '#587761',
  /** 이전 팔레트 호환용 별칭 */
  cream: '#FFFFF3',
  greenSoft: '#E8F3EC',
  greenMuted: '#8FB9A1',
} as const

export const BRAND_RADIUS = 22
export const BRAND_SHADOW = '0 12px 34px rgba(1,71,37,0.08)'
export const BRAND_SHADOW_STRONG = '0 18px 44px rgba(1,71,37,0.12)'
export const BRAND_GRADIENT_90 = `linear-gradient(90deg, ${BRAND.green} 0%, ${BRAND.greenMid} 100%)`
export const BRAND_GRADIENT_135 = `linear-gradient(135deg, ${BRAND.green} 0%, ${BRAND.greenMid} 100%)`

/** 화면 배경. 시안과 동일하게 단색입니다. */
export const BRAND_PAGE_BG = BRAND.bg

// ---------------------------------------------------------------------------
// 시안 CSS 를 1:1 로 옮긴 값들.
// 색만 맞추고 컴포넌트를 그대로 두면 인상이 달라지지 않아, 형태값까지 정본화합니다.
// ---------------------------------------------------------------------------

/** 카드 테두리. 시안은 회색 선이 아니라 "옅은 초록"입니다. */
export const BRAND_CARD_BORDER = '1px solid rgba(1, 71, 37, 0.12)'   // 홈 --mb-line

/** 셸 — .app-shell / body */
export const SHELL = {
  /** .app-shell width: min(430px, 100%) */
  maxWidth: 430,
  /** 셸 바깥 배경 (body) */
  outerBg: '#F2F5EE',
  /** .topbar height */
  topBarHeight: 58,
  /** .bottom-nav height */
  tabBarHeight: 72,
  topBarBg: 'rgba(255, 255, 243, 0.95)',
  topBarBorder: '1px solid rgba(1, 71, 37, 0.12)',
  tabBarBg: 'rgba(255, 255, 243, 0.97)',
  tabBarBorder: '1px solid #E1E9DA',
  /** .bottom-nav button 기본색 */
  /** 4.93:1 (이전 #748179 는 4.04 로 미달) */
  tabInactive: '#587761',
} as const

/** 타이포 — 시안의 실제 수치 */
export const TYPE = {
  /** 홈페이지와 동일한 자체 호스팅 Pretendard Std. index.css 의 --mebody-font 와 일치. */
  family: '"Pretendard Variable", Pretendard, "Noto Sans KR", system-ui, sans-serif',
  /** .intro h1 */
  heroTitle: { fontSize: '2.625rem', lineHeight: 1, letterSpacing: '-1px' },
  /** .simple-page > h1 */
  pageTitle: { fontSize: '2.125rem', lineHeight: 1, letterSpacing: '-1px' },
  /** .section-heading h2 */
  sectionTitle: { fontSize: '1.25rem', letterSpacing: '-0.4px' },
  /** .eyebrow */
  eyebrow: {
    fontSize: '0.8125rem',
    letterSpacing: '0.12em',
    fontWeight: 800,
    color: '#587761',   /* 4.07 → 4.93:1 */
    textTransform: 'uppercase' as const,
  },
  /** .section-number */
  sectionNumber: { fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.08em' },
  /** .lead */
  lead: { lineHeight: 1.55 },
} as const

/** 게이지 — .track / .status-exp-track */
export const GAUGE = {
  /** .track background */
  trackBg: '#E4EDE3',
  /** .status-exp-track background */
  progressBg: '#E1E9DA',
  /** .track:after 중앙 눈금 */
  tickColor: '#B4C7B8',
  height: 8,
  /** .track i 손잡이 */
  knobSize: 16,
} as const

/** 보조 표면색 — 시안에서 반복적으로 쓰이는 옅은 초록 회색들 */
export const SURFACE = {
  /** .hint / .info-note / .day-dot i */
  subtle: '#EFF4EC',
  /** .weekly-reward */
  soft: '#F2F6EF',
  /** .posture-illust / .product-image */
  placeholder: '#F0F4EC',
  /** .posture-scroll article border */
  hairline: '#E1E9DA',
} as const
