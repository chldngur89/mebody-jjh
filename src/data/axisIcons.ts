/**
 * Ver2 4가지 축 아이콘 (doc/ver2/축 아이콘)
 * public/axis-icons/ 에 복사된 이미지 경로
 */

export type AxisKey = 'neck' | 'shoulder' | 'pelvis' | 'flexibility';

export const AXIS_ICON_SRC: Record<AxisKey, string> = {
  neck: '/axis-icons/axis-neck.png',
  shoulder: '/axis-icons/axis-shoulder.png',
  pelvis: '/axis-icons/axis-pelvis.png',
  flexibility: '/axis-icons/axis-flexibility.png',
};
