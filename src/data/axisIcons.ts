import { SUPABASE_STORAGE_PUBLIC } from '../lib/supabase';

export type AxisKey = 'neck' | 'shoulder' | 'pelvis' | 'flexibility';

const axisStorageBase = SUPABASE_STORAGE_PUBLIC
  ? `${SUPABASE_STORAGE_PUBLIC}/axis`
  : '/axis-icons';

export const AXIS_ICON_SRC: Record<AxisKey, string> = {
  neck: `${axisStorageBase}/axis-neck.png`,
  shoulder: `${axisStorageBase}/axis-shoulder.png`,
  pelvis: `${axisStorageBase}/axis-pelvis.png`,
  flexibility: `${axisStorageBase}/axis-flexibility.png`,
};

export const AXIS_ICON_FALLBACK_SRC: Record<AxisKey, string> = {
  neck: '/axis-icons/axis-neck.png',
  shoulder: '/axis-icons/axis-shoulder.png',
  pelvis: '/axis-icons/axis-pelvis.png',
  flexibility: '/axis-icons/axis-flexibility.png',
};

/**
 * 화면 크기에 맞춘 파생본 (2026-09-22 감사 P2-1).
 *
 * 원본은 2048×2048 · 최대 5.7MB 인데 AnalyzingScreen 은 **48×48** 로 그립니다.
 * 48픽셀을 칠하려고 5.7MB 를 내려받고 있었습니다. 문항을 끝낸 모든 사용자가 지나는 길입니다.
 *
 * 파생본은 `npm run build:axis-icons` 로 만듭니다(48 / 96 / 144px WebP, 합계 31KB).
 * **원본을 지우지 않았습니다** — 더 크게 쓸 화면이 생기면 그때 다시 만들면 됩니다.
 *
 * Supabase 스토리지에는 파생본을 올리지 않았으므로 항상 앱 번들 쪽을 씁니다.
 * 스토리지에도 올리게 되면 여기 base 만 바꾸면 됩니다.
 */
const AXIS_ICON_SMALL_BASE = '/axis-icons/w'

/** 48px 로 그리는 자리의 기본 src. 구형 브라우저·WebP 미지원 대비로 png 도 남겨 둡니다. */
export const AXIS_ICON_SMALL_SRC: Record<AxisKey, string> = {
  neck: `${AXIS_ICON_SMALL_BASE}/axis-neck-96.webp`,
  shoulder: `${AXIS_ICON_SMALL_BASE}/axis-shoulder-96.webp`,
  pelvis: `${AXIS_ICON_SMALL_BASE}/axis-pelvis-96.webp`,
  flexibility: `${AXIS_ICON_SMALL_BASE}/axis-flexibility-96.webp`,
}

/** 화면 밀도에 맞는 것을 브라우저가 고르게 합니다. */
export const AXIS_ICON_SMALL_SRCSET: Record<AxisKey, string> = {
  neck: `${AXIS_ICON_SMALL_BASE}/axis-neck-48.webp 1x, ${AXIS_ICON_SMALL_BASE}/axis-neck-96.webp 2x, ${AXIS_ICON_SMALL_BASE}/axis-neck-144.webp 3x`,
  shoulder: `${AXIS_ICON_SMALL_BASE}/axis-shoulder-48.webp 1x, ${AXIS_ICON_SMALL_BASE}/axis-shoulder-96.webp 2x, ${AXIS_ICON_SMALL_BASE}/axis-shoulder-144.webp 3x`,
  pelvis: `${AXIS_ICON_SMALL_BASE}/axis-pelvis-48.webp 1x, ${AXIS_ICON_SMALL_BASE}/axis-pelvis-96.webp 2x, ${AXIS_ICON_SMALL_BASE}/axis-pelvis-144.webp 3x`,
  flexibility: `${AXIS_ICON_SMALL_BASE}/axis-flexibility-48.webp 1x, ${AXIS_ICON_SMALL_BASE}/axis-flexibility-96.webp 2x, ${AXIS_ICON_SMALL_BASE}/axis-flexibility-144.webp 3x`,
}
