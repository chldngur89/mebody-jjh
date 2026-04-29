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
