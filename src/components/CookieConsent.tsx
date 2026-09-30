/**
 * IMMUTABLE — 쿠키·이용 통계 동의는 **화면 하단 배너만**.
 *
 * 제품 결정(2026-09-30, 사용자 고정):
 *   · 항상 앱 셸 하단에만 뜬다. 전체 화면을 가리지 않는다.
 *   · 백드롭 / inset:0 / height:100% / 풀스크린 모달 금지.
 *   · 홈·랜딩 본문은 배너 뒤에서도 보여야 한다.
 *   · 이 동작을 "개선"한다며 바꾸지 말 것. Cursor 규칙:
 *     .cursor/rules/cookie-consent-banner.mdc
 *   · 회귀 방지: npm run verify:cookie-banner (build 에 포함)
 *
 * AdSense 맞춤형 광고 동의 관리용. 거부가 기본값입니다.
 * 저장은 localStorage 한 곳. AdSlot · lib/analytics 가 읽습니다.
 */
import { useCallback, useEffect, useState } from 'react';
import { SHELL } from '../theme/brand';

const STORAGE_KEY = 'mebody.cookieConsent.v1';

export type CookieConsent = 'accepted' | 'rejected' | null;

export function readCookieConsent(): CookieConsent {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === 'accepted' || raw === 'rejected' ? raw : null;
  } catch {
    return null;
  }
}

function writeCookieConsent(value: Exclude<CookieConsent, null>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* 저장 불가 환경에서는 이번 방문에만 적용됩니다 */
  }
  window.dispatchEvent(new CustomEvent('mebody:cookie-consent', { detail: value }));
}

/** 동의 상태를 구독합니다. 배너에서 바꾸면 즉시 반영됩니다. */
export function useCookieConsent(): CookieConsent {
  const [consent, setConsent] = useState<CookieConsent>(() => readCookieConsent());
  useEffect(() => {
    const onChange = () => setConsent(readCookieConsent());
    window.addEventListener('mebody:cookie-consent', onChange);
    return () => window.removeEventListener('mebody:cookie-consent', onChange);
  }, []);
  return consent;
}

export function CookieConsentBanner({
  privacyUrl = '/privacy.html',
  /**
   * 하단 5탭 셸 위에 떠 있는가.
   * true 면 탭바 높이만큼 더 올려서 탭을 가리지 않게 합니다.
   */
  aboveTabBar = false,
}: {
  privacyUrl?: string;
  aboveTabBar?: boolean;
}) {
  const [consent, setConsent] = useState<CookieConsent>(() => readCookieConsent());

  const decide = useCallback((value: Exclude<CookieConsent, null>) => {
    writeCookieConsent(value);
    setConsent(value);
  }, []);

  if (consent) return null;

  // AdMob 배너 → 탭바 → 이 안내문. 본문 위에 얹히는 하단 바만입니다.
  const lift = aboveTabBar ? 'calc(var(--mebody-tabbar-h, 72px) + 10px)' : '12px';

  return (
    <div
      className="mebody-cookie-banner"
      role="dialog"
      aria-label="쿠키 사용 동의"
      aria-modal="false"
      style={{
        // 앱 셸(relative) 하단만. 백드롭·전체 덮개 없음.
        // .mebody-frame > * { height:100% } 에 안 잡히도록 클래스 제외 + 높이 고정.
        position: 'absolute',
        left: '12px',
        right: '12px',
        bottom: `calc(var(--mebody-ad-inset, 0px) + ${lift})`,
        top: 'auto',
        height: 'auto',
        maxHeight: 'none',
        width: 'auto',
        maxWidth: `${SHELL.maxWidth - 24}px`,
        margin: '0 auto',
        zIndex: 60,
        boxSizing: 'border-box',
        background: '#FFFFF3',
        color: '#014725',
        borderRadius: '16px',
        border: '1px solid rgba(1, 71, 37, 0.18)',
        boxShadow: '0 10px 28px rgba(0, 0, 0, 0.18)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#014725' }}>쿠키·이용 통계 안내</div>
        <p
          style={{
            fontSize: '0.75rem',
            lineHeight: 1.5,
            color: '#3D6B54',
            wordBreak: 'keep-all',
            margin: '4px 0 0',
          }}
        >
          서비스 개선을 위해 화면별 이용 통계를 남깁니다(180일 보관). 동의하면 광고 개인화와 방문 연결도
          켜집니다. 「필수만」을 골라도 그대로 이용할 수 있고, 이름·연락처·문항 답변은 어느 쪽이든 보내지
          않습니다.{' '}
          <a
            href={privacyUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#014725', fontWeight: 800 }}
          >
            자세히
          </a>
        </p>
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => decide('rejected')}
          style={{
            minHeight: '44px',
            padding: '0 14px',
            borderRadius: '12px',
            border: '1px solid rgba(1, 71, 37, 0.22)',
            background: '#ffffff',
            color: '#3D6B54',
            fontSize: '0.8125rem',
            fontWeight: 800,
            fontFamily: 'inherit',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          필수만
        </button>
        <button
          type="button"
          onClick={() => decide('accepted')}
          style={{
            minHeight: '44px',
            padding: '0 16px',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
            color: '#ffffff',
            fontSize: '0.8125rem',
            fontWeight: 800,
            fontFamily: 'inherit',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          동의
        </button>
      </div>
    </div>
  );
}
