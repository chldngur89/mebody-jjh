import type { CapacitorConfig } from '@capacitor/cli';

/**
 * MEBODY 앱 껍데기.
 * 웹 코드는 그대로 두고 dist 빌드 결과물을 앱이 그대로 로드합니다.
 * AdMob 은 여기 앱 ID 로 초기화됩니다(광고 단위 ID 는 src/lib/ads.ts).
 */
const config: CapacitorConfig = {
  appId: 'net.mebody.app',
  appName: 'mebody',
  webDir: 'dist',
  android: {
    // 웹뷰가 로컬 파일을 https 스킴으로 읽게 해 Supabase 등 보안 컨텍스트 요구를 만족시킵니다.
    allowMixedContent: false,
  },
  plugins: {
    AdMob: {
      // AdMob 앱 ID (광고 단위 ID 와 다릅니다 — 이건 앱 전체에 1개)
      appId: 'ca-app-pub-4213603824572038~9522980806',
      // initializeForTesting 을 여기 두지 않습니다.
      //
      // 안드로이드 플러그인은 이 값을 **initialize() 호출에서만** 읽습니다
      // (AdMob.java: call.getBoolean("initializeForTesting", false)).
      // 여기 적어도 안 읽히는데 "테스트 모드로 나간다" 는 오해만 만듭니다.
      // 실제 값은 src/lib/ads.ts 가 실 단위 보유 여부로 정해서 넘깁니다.
      //
      // 에뮬레이터에 「Test Ad」가 뜨는 것은 이 설정 때문이 아니라
      // AdMob SDK 가 에뮬레이터를 자동으로 테스트 기기로 보기 때문입니다.
    },
  },
};

export default config;
