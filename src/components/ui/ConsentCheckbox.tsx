/**
 * 동의 체크박스 — 진단 플로우(ConsentScreen)와 회원가입(AuthScreen)이 공유합니다.
 *
 * 약관 UI 를 두 벌로 두면 반드시 어긋나므로 한 곳에만 둡니다.
 * 링크 문구·경로는 theme/copy.ts 의 LEGAL 상수 하나만 봅니다.
 */
import { useState, type ReactNode } from 'react';
import { BRAND } from '../../theme/brand';
import { LEGAL } from '../../theme/copy';
import { useOverlayBack } from '../../utils/useOverlayBack';

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
          borderRadius: '12px',
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

/**
 * 약관 문서를 **앱 안에서** 띄웁니다. 닫으면 보던 화면 그대로 돌아옵니다.
 *
 * 예전에는 target="_blank" 였습니다. 네이티브 앱에서는 새 창이 열리면서
 *   · 돌아올 버튼이 어디에도 없고
 *   · 문서 안의 「홈으로」 를 누르면 앱 첫 화면으로 가 **입력하던 가입 폼이 날아갑니다**
 * 두 문제가 같이 났습니다. 동의하려고 약관을 열었다가 가입을 처음부터 다시 하게 됩니다.
 *
 * 문서 자체는 public/privacy.html · public/terms.html 그대로 씁니다(웹에서도 같은 파일).
 * 두 벌로 만들면 반드시 어긋나므로 iframe 으로 끼워 넣기만 합니다.
 */
function LegalSheet({ path, title, onClose }: { path: string; title: string; onClose: () => void }) {
  // 안드로이드 하드웨어 뒤로가기도 이 시트를 먼저 닫습니다(화면이 넘어가지 않습니다).
  const close = useOverlayBack(true, onClose);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: BRAND.bg,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '0 8px 0 18px',
          height: '56px',
          flexShrink: 0,
          borderBottom: '1px solid rgba(1,71,37,0.10)',
        }}
      >
        <strong style={{ fontSize: '1rem', color: BRAND.green }}>{title}</strong>
        <button
          type="button"
          onClick={close}
          className="mebody-hit"
          style={{
            border: 0,
            background: 'transparent',
            color: BRAND.green,
            fontFamily: 'inherit',
            fontWeight: 800,
            fontSize: '0.875rem',
            minHeight: '44px',
            padding: '0 12px',
            cursor: 'pointer',
          }}
        >
          닫기
        </button>
      </header>
      <iframe
        src={path}
        title={title}
        style={{ flex: 1, minHeight: 0, border: 0, width: '100%', background: BRAND.bg }}
      />
    </div>
  );
}

/** "개인정보처리방침과 이용약관에 동의합니다." — 링크는 앱 안에서 열립니다. */
export function LegalConsentLabel() {
  const [open, setOpen] = useState<null | 'privacy' | 'terms'>(null);
  // 링크는 <a> 로 둡니다. 웹에서는 그대로 눌러도 되고, 보조 기술에도 링크로 읽힙니다.
  // 앱 안에서는 기본 동작을 막고 시트로 엽니다.
  const link = (kind: 'privacy' | 'terms', href: string, label: string) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOpen(kind);
      }}
      style={LINK_STYLE}
    >
      {label}
    </a>
  );
  return (
    <>
      {link('privacy', LEGAL.privacyPath, LEGAL.privacyLabel)}
      과{' '}
      {link('terms', LEGAL.termsPath, LEGAL.termsLabel)}
      에 동의합니다.
      {open && (
        <LegalSheet
          path={open === 'privacy' ? LEGAL.privacyPath : LEGAL.termsPath}
          title={open === 'privacy' ? LEGAL.privacyLabel : LEGAL.termsLabel}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
