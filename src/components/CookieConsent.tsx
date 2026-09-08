/**
 * 쿠키 동의 배너
 *
 * AdSense 는 맞춤형 광고에 동의 관리를 요구합니다(특히 EEA).
 * 여기서는 **거부를 기본값**으로 둡니다 — 동의하기 전에는 광고 개인화를 켜지 않습니다.
 *
 * 저장은 localStorage 한 곳뿐입니다. 서버로 보내지 않습니다.
 * AdSlot 은 이 값을 읽어 광고 로드 여부와 개인화 여부를 정합니다.
 */
import { useCallback, useEffect, useState } from 'react';
import { AXIS_GREEN_THEME } from '../data/axisTheme';
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
   * true 면 탭바(72px) 높이만큼 더 올려서 홈·미션·루틴·마켓·내상태를 가리지 않게 합니다.
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

  // 네이티브 AdMob 배너(--mebody-ad-inset) → 그 위에 탭바 → 그 위에 이 안내문 순서로 쌓입니다.
  const lift = aboveTabBar ? `${SHELL.tabBarHeight + 10}px` : '12px';

  return (
    <div
      role="dialog"
      aria-label="쿠키 사용 동의"
      style={{
        // absolute 로 두면 부모 높이가 콘텐츠를 따라 늘어날 때 화면 밖으로 밀리거나
        // 탭바 위에 얹혀 메뉴를 덮습니다. 탭바와 같은 방식으로 뷰포트에 고정합니다.
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        width: `min(${SHELL.maxWidth - 24}px, calc(100% - 24px))`,
        bottom: `calc(var(--mebody-ad-inset, 0px) + ${lift})`,
        // 탭바(30)·스크롤 인디케이터(50)보다 위. 동의 전에는 이 안내문이 가장 위에 있어야 합니다.
        zIndex: 60,
        borderRadius: '16px',
        border: `1px solid ${AXIS_GREEN_THEME.borderStrong}`,
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 12px 30px rgba(15,23,42,0.16)',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '12px', fontWeight: 900, color: '#111827' }}>쿠키 사용 안내</div>
        <p style={{ fontSize: '11px', lineHeight: 1.5, color: '#6b7280', wordBreak: 'keep-all', margin: '3px 0 0' }}>
          무료 이용 시 광고 목적 쿠키를 함께 씁니다. 거부해도 그대로 이용할 수 있어요.{' '}
          <a href={privacyUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#014725', fontWeight: 800 }}>
            자세히
          </a>
        </p>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => decide('rejected')}
          style={{
            height: '34px',
            padding: '0 11px',
            borderRadius: '10px',
            border: `1px solid ${AXIS_GREEN_THEME.border}`,
            background: '#ffffff',
            color: '#4b5563',
            fontSize: '12px',
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
            height: '34px',
            padding: '0 13px',
            borderRadius: '10px',
            border: 'none',
            background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
            color: '#ffffff',
            fontSize: '12px',
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
