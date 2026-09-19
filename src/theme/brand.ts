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
 * ── 다크 모드 (2026-09-16)
 * 값이 hex 에서 `var(--mebody-*, <원래hex>)` 로 바뀌었습니다.
 *   · 밝은 모드는 그대로입니다. 변수의 light 값이 원래 hex 이고, 폴백에도 같은 hex 가
 *     남아 있어 변수를 못 읽는 환경에서도 지금과 같은 색이 나옵니다.
 *   · 다크 값은 홈페이지 landing.css 의 `html[data-mb-route="app"]` 램프와 같습니다.
 *     두 화면이 같은 다크 팔레트를 쓰도록 정본을 하나로 둡니다.
 *   · 정의는 src/index.css 의 `:root` / `prefers-color-scheme: dark` 블록입니다.
 *
 * `green` 과 `text` 는 밝은 모드에서 같은 hex 지만 **다크에서 갈라집니다**:
 *   green → #3fa971 (강조·채움), text → #e9efe4 (본문 14.69:1).
 * 그래서 둘을 계속 구분해서 쓰십시오. 채움 위 글씨는 `BRAND.onGreen` 입니다.
 *
 * 캔버스(lib/shareCardImage.ts)는 CSS 변수를 읽을 수 없어 리터럴 hex 를 유지합니다.
 *
 * ROLLBACK: git checkout main -- src/theme/brand.ts src/data/axisTheme.ts
 */
export const BRAND = {
  /** 페이지 배경 — 홈페이지 --mb-cream 과 동일. 단색, 그라데이션 없음. */
  bg: 'var(--mebody-bg, #FFFFF3)',
  /** 카드 표면 — 크림 위에서 한 단계 떠 보이게 */
  card: 'var(--mebody-card, #FFFFFF)',
  /** 강조·채움. 밝은 모드 10.81:1 / 다크 #3fa971 5.84:1 */
  green: 'var(--mebody-green, #014725)',
  /** 홈페이지 --mb-green-2. 6.60:1 */
  greenMid: 'var(--mebody-green-mid, #016B38)',
  mint: 'var(--mebody-mint, #E8F3EC)',
  /** 홈페이지 --mb-line 을 크림 위에 합성한 값 */
  line: 'var(--mebody-line, #E1E9DA)',
  /** 본문 — 밝은 모드는 브랜드 그린, 다크는 #e9efe4 (14.69:1) */
  text: 'var(--mebody-ink, #014725)',
  /** 홈페이지 --mb-ink-50. 4.93:1 (이전 #6D7B73 은 4.23 으로 미달) */
  muted: 'var(--mebody-muted, #587761)',
  /**
   * 초록 채움 위의 글씨.
   * 밝은 모드는 흰색, 다크는 어두운 색입니다 — 다크의 채움(#3fa971) 위에서
   * 흰 글씨는 2.8:1 로 못 읽습니다. 채움 위 글씨는 반드시 이 값을 쓰십시오.
   */
  onGreen: 'var(--mebody-on-green, #ffffff)',
  /** 채움 위의 보조 글씨(예전 rgba(255,255,255,.8) 자리) */
  onGreenMuted: 'var(--mebody-on-green-muted, rgba(255,255,255,0.8))',
  /** 이전 팔레트 호환용 별칭 */
  cream: 'var(--mebody-bg, #FFFFF3)',
  greenSoft: 'var(--mebody-mint, #E8F3EC)',
  greenMuted: 'var(--mebody-green-muted, #8FB9A1)',
} as const

export const BRAND_RADIUS = 22
export const BRAND_SHADOW = '0 12px 34px var(--mebody-shadow, rgba(1,71,37,0.08))'
export const BRAND_SHADOW_STRONG = '0 18px 44px var(--mebody-shadow-strong, rgba(1,71,37,0.12))'
export const BRAND_GRADIENT_90 = `linear-gradient(90deg, ${BRAND.green} 0%, ${BRAND.greenMid} 100%)`
export const BRAND_GRADIENT_135 = `linear-gradient(135deg, ${BRAND.green} 0%, ${BRAND.greenMid} 100%)`

/** 화면 배경. 시안과 동일하게 단색입니다. */
export const BRAND_PAGE_BG = BRAND.bg

// ---------------------------------------------------------------------------
// 시안 CSS 를 1:1 로 옮긴 값들.
// 색만 맞추고 컴포넌트를 그대로 두면 인상이 달라지지 않아, 형태값까지 정본화합니다.
// ---------------------------------------------------------------------------

/** 카드 테두리. 시안은 회색 선이 아니라 "옅은 초록"입니다. */
export const BRAND_CARD_BORDER = '1px solid var(--mebody-card-border, rgba(1, 71, 37, 0.12))'   // 홈 --mb-line

/** 셸 — .app-shell / body */
export const SHELL = {
  /** .app-shell width: min(430px, 100%) */
  maxWidth: 430,
  /** 셸 바깥 배경 (body) */
  outerBg: 'var(--mebody-outer-bg, #F2F5EE)',
  /** .topbar height */
  topBarHeight: 58,
  /** .bottom-nav height */
  tabBarHeight: 72,
  topBarBg: 'var(--mebody-bar-bg, rgba(255, 255, 243, 0.95))',
  topBarBorder: '1px solid var(--mebody-card-border, rgba(1, 71, 37, 0.12))',
  tabBarBg: 'var(--mebody-bar-bg-strong, rgba(255, 255, 243, 0.97))',
  tabBarBorder: '1px solid var(--mebody-line, #E1E9DA)',
  /** .bottom-nav button 기본색 */
  /** 4.93:1 (이전 #748179 는 4.04 로 미달) */
  tabInactive: 'var(--mebody-muted, #587761)',
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
    color: 'var(--mebody-muted, #587761)',   /* 4.07 → 4.93:1 */
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
  trackBg: 'var(--mebody-track, #E4EDE3)',
  /** .status-exp-track background */
  progressBg: 'var(--mebody-track-2, #E1E9DA)',
  /** .track:after 중앙 눈금 */
  tickColor: 'var(--mebody-tick, #B4C7B8)',
  height: 8,
  /** .track i 손잡이 */
  knobSize: 16,
} as const

/** 보조 표면색 — 시안에서 반복적으로 쓰이는 옅은 초록 회색들 */
export const SURFACE = {
  /** .hint / .info-note / .day-dot i */
  subtle: 'var(--mebody-inset, #EFF4EC)',
  /** .weekly-reward */
  soft: 'var(--mebody-inset-2, #F2F6EF)',
  /** .posture-illust / .product-image */
  placeholder: 'var(--mebody-placeholder, #F0F4EC)',
  /** .posture-scroll article border */
  hairline: 'var(--mebody-line, #E1E9DA)',
} as const
