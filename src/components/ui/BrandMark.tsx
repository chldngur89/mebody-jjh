/**
 * mebody 브랜드 마크 — 길이가 다른 라운드 바 4개 (목 · 어깨 · 골반 · 하체).
 *
 * 좌표는 scripts/make-icons.py 의 `mark_rects()` 가 뽑아 public/brand-mark.svg 로
 * 저장한 것과 **같은 값**입니다. 앱 아이콘 · 파비콘 · 이 컴포넌트가 한 형태를 씁니다.
 * 형태를 바꿀 때는 그 스크립트를 고치고 다시 돌리세요 — 여기만 고치면 어긋납니다.
 *
 * 브랜드 정책:
 *   - 마크는 아이콘 자리에만 쓴다 (앱 아이콘 · 파비콘 · 랜딩 히어로 타일 · 헤더 로고)
 *   - lucide 의 Sparkles 같은 범용 아이콘을 로고로 쓰지 않는다
 */

/** 마크 원본 비율 — 304 × 308 */
const W = 304;
const H = 308;

export function BrandMark({
  size = 20,
  color = 'currentColor',
  title,
}: {
  /** 높이(px). 폭은 비율대로 따라갑니다. */
  size?: number;
  color?: string;
  /** 주면 스크린리더가 읽습니다. 장식으로 쓸 때는 비워 두세요. */
  title?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      height={size}
      width={(size * W) / H}
      fill={color}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ flexShrink: 0, display: 'block' }}
    >
      <rect x="108" y="0" width="88" height="62" rx="31" />
      <rect x="0" y="82" width="304" height="62" rx="31" />
      <rect x="52" y="164" width="200" height="62" rx="31" />
      <rect x="86" y="246" width="132" height="62" rx="31" />
    </svg>
  );
}
