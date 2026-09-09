import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type SessionResponse = Awaited<ReturnType<typeof supabase.auth.getSession>>;

const SESSION_TIMEOUT_MS = 3000;

function getSupabaseStorageKey() {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '');
  try {
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    return `sb-${projectRef}-auth-token`;
  } catch {
    return undefined;
  }
}

export function isInvalidRefreshTokenError(error: unknown): boolean {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : String(error ?? '');
  return /invalid refresh token|refresh token not found/i.test(message);
}

export async function clearInvalidAuthSession(): Promise<void> {
  const storageKey = getSupabaseStorageKey();
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // ignore — we still clear storage below
  }
  if (storageKey) {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore storage failures in private mode
    }
  }
}

export function getStoredSupabaseSession(): Session | null {
  const storageKey = getSupabaseStorageKey();
  if (!storageKey) return null;

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;

    const session = JSON.parse(raw) as Session;
    const expiresAt = session.expires_at ?? 0;
    if (expiresAt && expiresAt * 1000 < Date.now()) return null;

    return session?.access_token ? session : null;
  } catch {
    return null;
  }
}

export async function getSessionWithFallback(): Promise<SessionResponse> {
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('Supabase session lookup timed out')), SESSION_TIMEOUT_MS);
      }),
    ]);

    if (result.error && isInvalidRefreshTokenError(result.error)) {
      await clearInvalidAuthSession();
      return { data: { session: null }, error: null };
    }

    return result;
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await clearInvalidAuthSession();
      return { data: { session: null }, error: null };
    }

    console.debug('Supabase session lookup fallback:', error);
    return {
      data: { session: getStoredSupabaseSession() },
      error: null,
    };
  }
}

/**
 * After a hard refresh / partial cache clear, localStorage can keep a session
 * whose refresh token no longer exists on the server. Supabase auto-refresh
 * then throws AuthApiError. Validate once and clear local auth if needed.
 */
export async function recoverAuthSession(): Promise<Session | null> {
  const { data, error } = await getSessionWithFallback();
  if (error && isInvalidRefreshTokenError(error)) {
    await clearInvalidAuthSession();
    return null;
  }

  const session = data.session;
  if (!session?.refresh_token) return session ?? null;

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError && isInvalidRefreshTokenError(userError)) {
      await clearInvalidAuthSession();
      return null;
    }
    // Transient network / getUser failures must not wipe a still-valid refresh session.
    if (userError) {
      console.debug('Supabase getUser recovery:', userError.message);
      return session;
    }
    if (!userData.user) return null;
    return session;
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await clearInvalidAuthSession();
      return null;
    }
    console.debug('Supabase auth recovery fallback:', error);
    return session;
  }
}
