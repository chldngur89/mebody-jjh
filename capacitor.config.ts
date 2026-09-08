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
      // 테스트 기기에서는 항상 테스트 광고를 띄웁니다. 실기기 실광고는 스토어 배포 후.
      initializeForTesting: true,
    },
  },
};

export default config;
