export interface TimerProgress { remaining: number; started: boolean }
export function parseTimerProgress(raw: string | null, duration: number): TimerProgress {
  try {
    const data = JSON.parse(raw ?? 'null');
    if (data && Number.isFinite(data.remaining) && data.remaining >= 0 && data.remaining <= duration) {
      return { remaining: Math.floor(data.remaining), started: Boolean(data.started) };
    }
  } catch { /* invalid or unavailable storage */ }
  return { remaining: duration, started: false };
}
export function readTimerProgress(key: string, duration: number) {
  try { return parseTimerProgress(sessionStorage.getItem(key), duration); }
  catch { return { remaining: duration, started: false }; }
}
export function saveTimerProgress(key: string, progress: TimerProgress) {
  try { sessionStorage.setItem(key, JSON.stringify(progress)); } catch { /* memory only */ }
}
