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
    <header style={{ marginBottom: '6px' }}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 style={{ ...t, margin: '7px 0 0', color: BRAND.green, fontWeight: 800 }}>{title}</h1>
      {lead && (
        <p style={{ ...TYPE.lead, color: BRAND.muted, margin: '8px 0 0', wordBreak: 'keep-all' }}>{lead}</p>
      )}
    </header>
  );
}
