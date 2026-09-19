/**
 * 동의 체크박스 — 진단 플로우(ConsentScreen)와 회원가입(AuthScreen)이 공유합니다.
 *
 * 약관 UI 를 두 벌로 두면 반드시 어긋나므로 한 곳에만 둡니다.
 * 링크 문구·경로는 theme/copy.ts 의 LEGAL 상수 하나만 봅니다.
 */
import type { ReactNode } from 'react';
import { LEGAL } from '../../theme/copy';

const LINK_STYLE = {
  color: 'var(--mebody-t-014725, #014725)',
  fontWeight: 800,
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
} as const;

export function ConsentCheckbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label
      className="mebody-field"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        // 체크박스 줄 전체가 탭 영역이라 44px 를 넘습니다 (22px 박스 + 위아래 12px 패딩).
        borderRadius: '14px',
        background: 'var(--mebody-s-ffffff, #ffffff)',
        padding: '12px 14px',
        border: '1px solid var(--mebody-b-e1e9da, #E1E9DA)',
        cursor: 'pointer',
      }}
    >
      {/* 실제 체크박스는 보이지 않게 두되 DOM 에 남깁니다 —
          스크린리더가 checkbox 역할과 checked 상태를 그대로 읽습니다. */}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
      <span
        aria-hidden
        style={{
          width: '22px',
          height: '22px',
          marginTop: '1px',
          borderRadius: '6px',
          border: checked ? '2px solid var(--mebody-b-016b38, #016B38)' : '2px solid var(--mebody-b-6f8c7b, #6F8C7B)',
          background: checked ? 'var(--mebody-s-016b38, #016B38)' : 'var(--mebody-s-ffffff, #ffffff)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      >
        {checked && <span style={{ color: 'var(--mebody-t-ffffff-2, #ffffff)', fontSize: '0.875rem', fontWeight: 900, lineHeight: 1 }}>✓</span>}
      </span>
      <span style={{ fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--mebody-t-2c5544, #2C5544)', wordBreak: 'keep-all', flex: 1 }}>
        {children}
      </span>
    </label>
  );
}

/** "개인정보처리방침과 이용약관에 동의합니다." — 링크 두 개는 새 탭에서 엽니다. */
export function LegalConsentLabel() {
  return (
    <>
      <a
        href={LEGAL.privacyPath}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
        style={LINK_STYLE}
      >
        {LEGAL.privacyLabel}
      </a>
      과{' '}
      <a
        href={LEGAL.termsPath}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
        style={LINK_STYLE}
      >
        {LEGAL.termsLabel}
      </a>
      에 동의합니다.
    </>
  );
}
