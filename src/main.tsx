import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { recoverAuthSession } from "./lib/authSession";
import { installChunkLoadRecovery } from "./lib/chunkLoadRecovery";
import { installAppViewportHeight, installInAppFocusAssist } from "./lib/viewport";

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
installInAppFocusAssist();
retireLegacyPwaCache();
void recoverAuthSession().catch(() => undefined);

createRoot(document.getElementById("root")!).render(<App />);
