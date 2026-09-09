const RELOAD_KEY = 'mebody:chunk-reload';
const RELOAD_WINDOW_MS = 15_000;

/** In-memory guard so private-mode (no sessionStorage) cannot infinite-reload. */
let lastReloadAt = 0;

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Loading chunk [\d]+ failed/i.test(message)
  );
}

/** One hard reload after a deploy when an old hashed chunk 404s. */
export function reloadForStaleChunk(reason = 'stale-chunk'): boolean {
  if (typeof window === 'undefined') return false;

  const now = Date.now();
  if (lastReloadAt && now - lastReloadAt < RELOAD_WINDOW_MS) return false;

  try {
    const raw = sessionStorage.getItem(RELOAD_KEY);
    const last = raw ? Number(raw) : 0;
    if (last && now - last < RELOAD_WINDOW_MS) {
      lastReloadAt = last;
      return false;
    }
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    // private mode — memory guard above still applies
  }

  lastReloadAt = now;
  console.warn(`[mebody] Reloading after ${reason}`);
  window.location.reload();
  return true;
}

export function installChunkLoadRecovery() {
  if (typeof window === 'undefined') return;

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadForStaleChunk('vite-preload-error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadError(event.reason)) return;
    event.preventDefault();
    reloadForStaleChunk('dynamic-import-rejection');
  });
}

export function lazyImportWithReload<T>(factory: () => Promise<T>): Promise<T> {
  return factory().catch((error: unknown) => {
    if (isChunkLoadError(error) && reloadForStaleChunk('lazy-import')) {
      return new Promise<T>(() => undefined);
    }
    throw error;
  });
}
