/**
 * 시안의 .eyebrow + h1 + .lead
 *
 * .eyebrow{font-size:12px;letter-spacing:.12em;font-weight:800;color:#688072;text-transform:uppercase}
 * .simple-page>h1{font-size:34px;line-height:1;color:var(--green);letter-spacing:-1px}
 * .lead{color:var(--muted);line-height:1.55;margin-top:8px}
 */
import type { ReactNode } from 'react';
import { BRAND, TYPE } from '../../theme/brand';

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div style={{ ...TYPE.eyebrow }}>{children}</div>;
}

export function PageTitle({
  eyebrow,
  title,
  lead,
  size = 'page',
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  /** hero 는 42px(.intro h1), page 는 34px(.simple-page>h1) */
  size?: 'page' | 'hero';
}) {
  const t = size === 'hero' ? TYPE.heroTitle : TYPE.pageTitle;
  return (
    // position/zIndex 는 **안드로이드 WebView 페인트 버그** 때문에 있습니다. 지우지 마세요.
    //
    // 증상: 같은 화면 뒤쪽에 인라인 SVG(lucide 아이콘)가 있으면 이 header 블록이
    //       화면에 아예 안 그려졌습니다. 자리는 그대로 비워두고 글자만 사라집니다.
    // 확인: 마켓 탭에서 재현. DOM 도 computed style 도 멀쩡했습니다
    //       (h1 color=rgb(1,71,37) opacity=1 visibility=visible).
    //       CDP 로 런타임에서 ① z-index 부여 ② translateZ(0) ③ SVG 숨김 —
    //       셋 다 글자가 돌아왔고, 되돌리면 다시 사라졌습니다.
    // 선택: translateZ 는 GPU 레이어를 하나 더 만듭니다. 스태킹 컨텍스트만 만들면
    //       같은 효과가 공짜로 납니다. 그래서 z-index 쪽을 씁니다.
    <header style={{ marginBottom: '6px', position: 'relative', zIndex: 1 }}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 style={{ ...t, margin: '7px 0 0', color: BRAND.green, fontWeight: 800 }}>{title}</h1>
      {lead && (
        <p style={{ ...TYPE.lead, color: BRAND.muted, margin: '8px 0 0', wordBreak: 'keep-all' }}>{lead}</p>
      )}
    </header>
  );
}
