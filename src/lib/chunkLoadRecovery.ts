import { reportError } from './reportError';

const RELOAD_KEY = 'mebody:chunk-reload';
const RELOAD_COUNT_KEY = 'mebody:chunk-reload-count';
const RELOAD_WINDOW_MS = 15_000;
/**
 * 한 방문에서 허용하는 리로드 횟수.
 *
 * 이전에는 "15초 간격" 만 있었습니다. 청크 로드가 계속 실패하면
 * **15초마다 영원히 새로고침**돼서 화면이 자꾸 리프레쉬됐습니다.
 * 배포 직후 낡은 청크는 한 번만 다시 받으면 해결되므로, 두 번까지만 시도하고
 * 그 뒤에는 멈춥니다(더 눌러도 같은 결과이고, 루프가 오류보다 나쁩니다).
 */
const RELOAD_MAX_PER_SESSION = 2;

/** In-memory guard so private-mode (no sessionStorage) cannot infinite-reload. */
let lastReloadAt = 0;
let reloadsThisPageview = 0;

function readReloadCount(): number {
  try {
    return Number(sessionStorage.getItem(RELOAD_COUNT_KEY)) || 0;
  } catch {
    return reloadsThisPageview;
  }
}

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

  // 횟수 상한 — 여기가 무한 새로고침을 끊는 지점입니다.
  const count = readReloadCount();
  if (count >= RELOAD_MAX_PER_SESSION) {
    console.warn(`[mebody] Chunk reload limit reached (${count}). Not reloading again.`);
    reportError('chunk.reload_limit', { reason, count });
    return false;
  }

  try {
    const raw = sessionStorage.getItem(RELOAD_KEY);
    const last = raw ? Number(raw) : 0;
    if (last && now - last < RELOAD_WINDOW_MS) {
      lastReloadAt = last;
      return false;
    }
    sessionStorage.setItem(RELOAD_KEY, String(now));
    sessionStorage.setItem(RELOAD_COUNT_KEY, String(count + 1));
  } catch {
    // private mode — memory guard above still applies
  }
  reloadsThisPageview = count + 1;

  lastReloadAt = now;
  console.warn(`[mebody] Reloading after ${reason}`);
  window.location.reload();
  return true;
}

export function installChunkLoadRecovery() {
  if (typeof window === 'undefined') return;

  /*
   * 여기서 새로고침하지 않습니다.
   *
   * vite:preloadError 는 **미리 가져오기**(modulepreload)가 실패할 때도 뜹니다.
   * 그 청크가 실제로 필요하지 않을 수도 있는데, 예전에는 이때마다 페이지를
   * 새로고침해서 사용자 눈에 화면이 자꾸 깜빡였습니다.
   * 진짜로 필요한 청크가 안 들어오는 경우는 lazyImportWithReload() 가
   * 조용히 한 번 다시 받아보고, 그래도 안 되면 그때만 새로고침합니다.
   */
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reportError('chunk.preload_failed', { reason: 'vite-preload-error' });
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadError(event.reason)) return;
    event.preventDefault();
    reportError('chunk.preload_failed', { reason: 'dynamic-import-rejection' });
  });
}

/**
 * 화면 청크를 가져옵니다.
 * 실패하면 **먼저 조용히 한 번 다시** 받아봅니다(새로고침 없음 — 사용자는 모릅니다).
 * 그래도 안 되면 그때 한 번 새로고침합니다.
 */
export function lazyImportWithReload<T>(factory: () => Promise<T>): Promise<T> {
  return factory().catch(async (error: unknown) => {
    if (!isChunkLoadError(error)) throw error;

    // 조용한 재시도 — 배포 직후 잠깐 404 이던 청크가 대개 여기서 들어옵니다.
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      return await factory();
    } catch (retryError) {
      if (isChunkLoadError(retryError) && reloadForStaleChunk('lazy-import')) {
        // 새로고침이 시작됐으므로 이 화면은 더 그리지 않습니다.
        return new Promise<T>(() => undefined);
      }
      throw retryError;
    }
  });
}
