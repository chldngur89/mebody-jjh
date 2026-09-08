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

export function bannerUnitId(placement: BannerPlacement): string {
  const key = placement === 'result_bottom' ? 'VITE_ADMOB_BANNER_RESULT' : 'VITE_ADMOB_BANNER_ROUTINE'
  return envUnit(key) ?? TEST_UNITS.banner
}

export function rewardedUnitId(): string {
  return envUnit('VITE_ADMOB_REWARDED') ?? TEST_UNITS.rewarded
}

/** 실 광고 단위가 설정돼 있는지. false 면 테스트 광고가 나갑니다. */
export function hasRealAdUnits(): boolean {
  return Boolean(envUnit('VITE_ADMOB_BANNER_RESULT') || envUnit('VITE_ADMOB_REWARDED'))
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
function setAdInset(px: number) {
  if (typeof document === 'undefined') return
  // 배너가 맨 아래에 뜨므로 탭바와 본문을 그 높이만큼 위로 올려야 합니다.
  // TabBar 는 bottom 을, AppShell 은 paddingBottom 을 이 값으로 잡습니다.
  document.documentElement.style.setProperty('--mebody-ad-inset', `${Math.max(0, px)}px`)
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
      isTesting: !hasRealAdUnits(),
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
      isTesting: !hasRealAdUnits(),
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
