/**
 * 시안의 .topbar
 * .topbar{height:58px;position:sticky;top:0;background:rgba(250,250,240,.95);
 *   backdrop-filter:blur(8px);border-bottom:1px solid rgba(0,70,40,.06);z-index:20}
 * .brand{color:var(--green);font-weight:800;font-size:20px;letter-spacing:-.5px}
 */
import type { ReactNode } from 'react';
import { BRAND, SHELL } from '../../theme/brand';

export function TopBar({ onBrandClick, right }: { onBrandClick?: () => void; right?: ReactNode }) {
  return (
    <header
      style={{
        height: `${SHELL.topBarHeight}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 18px',
        position: 'sticky',
        top: 0,
        background: SHELL.topBarBg,
        backdropFilter: 'blur(8px)',
        borderBottom: SHELL.topBarBorder,
        zIndex: 20,
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={onBrandClick}
        style={{
          border: 0,
          background: 'transparent',
          padding: 0,
          color: BRAND.green,
          fontWeight: 800,
          fontSize: '20px',
          letterSpacing: '-0.5px',
          fontFamily: 'inherit',
          cursor: onBrandClick ? 'pointer' : 'default',
        }}
      >
        mebody
      </button>
      {right}
    </header>
  );
}
