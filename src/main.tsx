import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { recoverAuthSession } from "./lib/authSession";
import { installChunkLoadRecovery } from "./lib/chunkLoadRecovery";
import { installAppViewportHeight, installInAppFocusAssist } from "./lib/viewport";
import { installAndroidBack, installDeepLinks } from "./lib/androidBack";

function retireLegacyPwaCache() {
  if (typeof window === 'undefined') return;

  const clearCaches = async () => {
    if (!('caches' in window)) return;
    const keys = await window.caches.keys();
    await Promise.all(keys.map((key) => window.caches.delete(key)));
  };

  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(clearCaches)
      .catch(() => undefined);
    return;
  }

  void clearCaches().catch(() => undefined);
}

installChunkLoadRecovery();
installAppViewportHeight();
// 안드로이드 시스템 Back 을 화면 히스토리에 연결합니다(2026-09-27 점검 P0-2).
installAndroidBack();
// 재설정·확인 메일 링크가 앱으로 돌아올 수 있게 합니다(점검 P0-4).
installDeepLinks();
installInAppFocusAssist();
retireLegacyPwaCache();
void recoverAuthSession().catch(() => undefined);

createRoot(document.getElementById("root")!).render(<App />);
