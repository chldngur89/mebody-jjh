import { SUPABASE_STORAGE_PUBLIC } from '../lib/supabase';

export const LOCAL_FALLBACK_CHARACTER_IMAGE = '/icon.svg';

function normalizeBodyCode(bodyCode?: string | null): string {
  return String(bodyCode ?? '').trim().toUpperCase();
}

function isUsableImageUrl(url?: string, failedImageUrls?: Set<string>): url is string {
  const normalized = String(url ?? '').trim();
  if (!normalized) return false;
  if (normalized.includes('your-bucket.supabase.co')) return false;
  if (failedImageUrls?.has(normalized)) return false;
  return true;
}

export function getCharacterStorageUrl(bodyCode?: string | null): string {
  const normalized = normalizeBodyCode(bodyCode);
  if (!normalized || normalized.length !== 4 || !SUPABASE_STORAGE_PUBLIC) return '';
  return `${SUPABASE_STORAGE_PUBLIC}/characters/${normalized}.png`;
}

export function resolveCharacterImageUrl(
  bodyCode: string | null | undefined,
  appImages: Record<string, string>,
  failedImageUrls?: Set<string>,
): string {
  const normalized = normalizeBodyCode(bodyCode);
  if (!normalized || normalized.length !== 4) return LOCAL_FALLBACK_CHARACTER_IMAGE;

  const storageUrl = getCharacterStorageUrl(normalized);
  if (isUsableImageUrl(storageUrl, failedImageUrls)) return storageUrl;

  const appImageUrl = appImages[`character_${normalized}`];
  if (isUsableImageUrl(appImageUrl, failedImageUrls)) return appImageUrl.trim();

  return LOCAL_FALLBACK_CHARACTER_IMAGE;
}
