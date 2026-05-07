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
    return await Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('Supabase session lookup timed out')), SESSION_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.debug('Supabase session lookup fallback:', error);
    return {
      data: { session: getStoredSupabaseSession() },
      error: null,
    };
  }
}
