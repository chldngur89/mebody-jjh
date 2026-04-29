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

function normalizeCharacterUrl(url: string | undefined, bodyCode: string): string {
  const trimmed = String(url ?? '').trim();
  if (!trimmed || trimmed.includes('your-bucket.supabase.co')) return '';

  const expectedStorageUrl = getCharacterStorageUrl(bodyCode);

  if (/^https?:\/\//i.test(trimmed)) {
    if (trimmed.includes('/storage/v1/object/public/images/')) {
      const path = trimmed.split('/storage/v1/object/public/images/')[1] ?? '';
      if (path === `${bodyCode}.png` && expectedStorageUrl) return expectedStorageUrl;
    }
    return trimmed;
  }

  if (!SUPABASE_STORAGE_PUBLIC) return trimmed;

  let path = trimmed.replace(/^\/+/, '');
  if (path.startsWith('images/')) path = path.replace(/^images\/+/, '');
  if (path === `${bodyCode}.png`) path = `characters/${bodyCode}.png`;
  return `${SUPABASE_STORAGE_PUBLIC}/${path}`;
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

  const appImageUrl = normalizeCharacterUrl(appImages[`character_${normalized}`], normalized);
  if (isUsableImageUrl(appImageUrl, failedImageUrls)) return appImageUrl;

  return LOCAL_FALLBACK_CHARACTER_IMAGE;
}
