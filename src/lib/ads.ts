/**
 * 광고 계층 — AdMob(네이티브)과 웹을 하나의 인터페이스로 감쌉니다.
 *
 * · 네이티브(Capacitor) 에서만 실제 AdMob 이 뜹니다.
 * · 웹(브라우저)에서는 광고를 띄우지 않고 자사 프로모션으로 대체합니다.
 *   AdMob SDK 는 웹에서 로드되지 않으므로, 억지로 부르지 않고 조용히 비활성화합니다.
 * · 유료 회원 판단은 호출부에서 합니다. 이 파일은 "띄울 수 있는가"만 다룹니다.
 *
 * 광고 단위 ID 는 .env 로 주입합니다. 없으면 테스트 단위로 떨어집니다.
 */
import { Capacitor } from '@capacitor/core'

/** Google 공식 테스트 광고 단위 — 실 단위가 없을 때 이걸 씁니다 */
const TEST_UNITS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
} as const

export type BannerPlacement = 'result_bottom' | 'routine'

function envUnit(key: string): string | undefined {
  const value = (import.meta.env as Record<string, string | undefined>)[key]
  return value && value.trim() ? value.trim() : undefined
}

function bannerEnvKey(placement: BannerPlacement): string {
  return placement === 'result_bottom' ? 'VITE_ADMOB_BANNER_RESULT' : 'VITE_ADMOB_BANNER_ROUTINE'
}

export function bannerUnitId(placement: BannerPlacement): string {
  return envUnit(bannerEnvKey(placement)) ?? TEST_UNITS.banner
}

export function rewardedUnitId(): string {
  return envUnit('VITE_ADMOB_REWARDED') ?? TEST_UNITS.rewarded
}

/**
 * **형식별로** 실 단위가 있는지 봅니다.
 *
 * 예전에는 `hasRealAdUnits()` 하나가 "배너 또는 보상형 중 아무거나 있으면 true" 였습니다.
 * 배너만 넣고 보상형을 비워 두면 이런 일이 났습니다(2026-09-27 Android 점검 P1-1).
 *
 *   보상형 단위 → 구글 demo 단위로 떨어짐
 *   isTesting   → hasRealAdUnits() 가 true 라 false
 *   결과        → **구글 demo 단위를 운영 모드로 요청**
 *
 * demo 단위를 운영 모드로 부르는 것은 AdMob 정책 위반 소지가 있고 계정 정지까지 갑니다.
 * 그래서 광고 형식마다 따로 판단합니다. 한쪽이 비어도 다른 쪽을 끌고 들어가지 않습니다.
 */
export function isRealBanner(placement: BannerPlacement): boolean {
  return Boolean(envUnit(bannerEnvKey(placement)))
}

export function isRealRewarded(): boolean {
  return Boolean(envUnit('VITE_ADMOB_REWARDED'))
}

/**
 * 광고 형식 중 하나라도 실 단위가 있는지. **SDK 초기화에만** 씁니다.
 *
 * `AdMob.initialize({ initializeForTesting })` 는 SDK 전체에 한 번 거는 값이라
 * 형식별로 나눌 수 없습니다. 실제 요청의 테스트 여부는 각 호출의 `isTesting` 이 정하므로
 * 여기서는 "실 단위가 하나라도 있으면 운영 초기화" 로 둡니다.
 */
export function hasRealAdUnits(): boolean {
  return isRealBanner('result_bottom') || isRealBanner('routine') || isRealRewarded()
}

/** 네이티브 앱에서 실행 중인가. 웹이면 광고를 아예 시도하지 않습니다. */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

/**
 * AdMob 배너는 웹뷰 "위에" 겹쳐 그려집니다. 그래서 화면 안에 자리를 비워두는 것만으로는
 * 부족하고, 앱 전체 하단에 배너 높이만큼 여백을 줘야 콘텐츠가 안 가려집니다.
 * 실제 높이는 adaptive 라 기기마다 다르므로 bannerAdSizeChanged 로 받아서 씁니다.
 */
/**
 * env(safe-area-inset-bottom) 의 실제 픽셀값을 잽니다.
 *
 * CSS 의 env() 는 JS 에서 바로 읽을 수 없어 숨긴 요소의 높이로 대신 잽니다.
 */
function safeAreaBottomPx(): number {
  if (typeof document === 'undefined' || !document.body) return 0
  try {
    const probe = document.createElement('div')
    probe.style.cssText =
      'position:fixed;left:-9999px;bottom:0;width:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;'
    document.body.appendChild(probe)
    const px = probe.getBoundingClientRect().height
    probe.remove()
    return Number.isFinite(px) ? px : 0
  } catch {
    return 0
  }
}

function setAdInset(px: number) {
  if (typeof document === 'undefined') return
  // 배너가 맨 아래에 뜨므로 탭바와 본문을 그 높이만큼 위로 올려야 합니다.
  // TabBar 는 bottom 을, AppShell 은 paddingBottom 을 이 값으로 잡습니다.
  //
  // **배너 높이만으로는 모자랍니다.** 배너는 화면 맨 아래가 아니라 시스템 제스처바
  // **위**에 뜹니다. 그래서 배너 아래로 제스처바 높이만큼 웹 내용이 비쳐 보였습니다
  // (에뮬레이터 실측: 배너 180px 아래에 60px 이 비쳤고, 그게 제스처바 높이였습니다).
  // 배너가 있을 때만 그만큼을 더합니다. 배너가 없으면 0 이어야 합니다 —
  // 광고가 없는데 아래가 비면 그냥 빈 띠가 생깁니다.
  const safe = safeAreaBottomPx()
  const inset = px > 0 ? px + safe : 0
  document.documentElement.style.setProperty('--mebody-ad-inset', `${Math.max(0, inset)}px`)

  // 배너가 떠 있으면 **탭바는 안전영역을 또 비우지 않습니다.**
  //
  // 탭바는 높이(72px + 안전영역)와 아래 패딩으로 제스처바를 피합니다. 그런데 배너가
  // 이미 제스처바 위에 앉으므로, 그 상태에서 탭바까지 안전영역을 잡으면 두 번 잡힙니다.
  // 실측으로 탭바와 배너 사이에 110px 짜리 빈 띠가 생겼습니다.
  document.documentElement.style.setProperty(
    '--mebody-tabbar-safe', px > 0 ? '0px' : `${safe}px`)

  // 배너가 있을 때만 탭바 아래에 선을 그어 앱과 광고를 가릅니다(TabBar 참고).
  document.documentElement.style.setProperty(
    '--mebody-ad-divider', px > 0 ? '1px solid rgba(1,71,37,0.12)' : 'none')
  // 앱이 쓸 수 있는 높이를 다시 잡게 알립니다 — lib/viewport.ts 가 이 값을 빼고 계산합니다.
  window.dispatchEvent(new CustomEvent('mebody:ad-inset', { detail: inset }))
}

let sizeListenerBound = false
let initPromise: Promise<boolean> | null = null

/** AdMob 초기화. 한 번만 수행하고 결과를 재사용합니다. */
export async function initAds(): Promise<boolean> {
  if (!isNativeApp()) return false
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      const { AdMob, BannerAdPluginEvents } = await import('@capacitor-community/admob')
      await AdMob.initialize({ initializeForTesting: !hasRealAdUnits() })

      if (!sizeListenerBound) {
        sizeListenerBound = true
        // 배너가 뜨거나 크기가 바뀔 때마다 하단 여백을 그 높이에 맞춥니다.
        // 이벤트 이름은 문자열이 아니라 enum 을 써야 타입이 맞습니다.
        void AdMob.addListener(BannerAdPluginEvents.SizeChanged, (info) => {
          setAdInset(Number(info?.height ?? 0))
        })
      }
      return true
    } catch (error) {
      console.warn('AdMob 초기화 실패:', error)
      return false
    }
  })()

  return initPromise
}

/** 하단 배너를 띄웁니다. 웹이거나 실패하면 false. */
export async function showBanner(placement: BannerPlacement): Promise<boolean> {
  if (!(await initAds())) return false
  try {
    const { AdMob, BannerAdPosition, BannerAdSize } = await import('@capacitor-community/admob')
    await AdMob.showBanner({
      adId: bannerUnitId(placement),
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      // 배너는 화면 맨 아래에 붙입니다. 탭바가 배너 위로 올라옵니다
      // (TabBar 의 bottom 이 --mebody-ad-inset 만큼 밀려 올라갑니다).
      margin: 0,
      // 이 자리의 단위가 실 단위인지로 판정합니다. 다른 형식이 있는지는 상관없습니다.
      isTesting: !isRealBanner(placement),
    })
    return true
  } catch (error) {
    console.warn('배너 표시 실패:', error)
    return false
  }
}

export async function hideBanner(): Promise<void> {
  setAdInset(0)
  if (!isNativeApp()) return
  try {
    const { AdMob } = await import('@capacitor-community/admob')
    await AdMob.removeBanner()
  } catch {
    /* 이미 없으면 무시 */
  }
}

export type RewardedOutcome = 'rewarded' | 'dismissed' | 'unavailable'

/**
 * 서버 검증(SSV)에 실을 값.
 * userId 를 넣으면 AdMob 이 콜백에 그대로 담아 우리 서버로 보내고,
 * 서버가 서명을 확인한 뒤 그 사용자에게 보너스를 지급합니다.
 */
export interface SsvOptions {
  userId: string
  customData?: string
}

/**
 * 보상형 광고를 끝까지 보여주고 결과를 돌려줍니다.
 * 'rewarded' 일 때만 호출부가 보상을 요청해야 합니다.
 */
export async function showRewarded(options?: SsvOptions): Promise<RewardedOutcome> {
  if (!(await initAds())) return 'unavailable'
  try {
    const { AdMob } = await import('@capacitor-community/admob')
    await AdMob.prepareRewardVideoAd({
      adId: rewardedUnitId(),
      isTesting: !isRealRewarded(),
      // 서버 검증(SSV)에 실어 보낼 값. AdMob 이 우리 서버로 콜백할 때 그대로 돌려줍니다.
      // userId 로 누구에게 줄 보너스인지 알 수 있어야 서버가 지급할 수 있습니다.
      ...(options?.userId ? { ssv: { userId: options.userId, customData: options.customData } } : {}),
    })
    const reward = await AdMob.showRewardVideoAd()
    // 보상 객체가 오면 끝까지 시청한 것입니다. 중간에 닫으면 예외이거나 null 입니다.
    return reward ? 'rewarded' : 'dismissed'
  } catch (error) {
    console.warn('보상형 광고 실패:', error)
    return 'dismissed'
  }
}
