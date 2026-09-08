/**
 * 광고 슬롯 — 무료 사용자에게만 보입니다.
 *
 * · 유료(활성 구독) 사용자에게는 **아무것도 렌더하지 않습니다.** 빈 상자도 남기지 않습니다.
 * · AdSense 승인 전에는 자사 상품 프로모션을 같은 자리에 넣어 레이아웃을 먼저 확정합니다.
 *   승인 후 renderAd 안쪽만 <ins class="adsbygoogle"> 로 교체하면 됩니다.
 *
 * 주의(정책): 적립금을 "광고 보상" 으로 표기하면 AdSense 인센티브 정책 위반입니다.
 * 적립 문구는 "미션 완료 보상" 으로만 쓰고, 이 슬롯과 주사위 카드를 붙여 배치하지 마세요.
 */
import { useEffect } from 'react';
import { AXIS_GREEN_THEME } from '../data/axisTheme';
import { hideBanner, isNativeApp, showBanner, type BannerPlacement } from '../lib/ads';
import { useCookieConsent } from './CookieConsent';

interface AdSlotProps {
  /** 활성 구독이면 렌더하지 않습니다 */
  isPaid: boolean;
  /** 어느 자리인지 — 광고 단위가 자리별로 다릅니다 */
  placement: BannerPlacement;
  /** 승인 전 자리를 채울 자사 프로모션 */
  house?: { title: string; body: string; onClick?: () => void };
}

export function AdSlot({ isPaid, placement, house }: AdSlotProps) {
  // 동의 전/거부 상태에서는 비개인화 광고만 씁니다(AdSense 의 npa=1 에 해당).
  // 실제 광고 태그를 붙일 때 이 값을 data-npa 로 전달합니다.
  const consent = useCookieConsent();
  const personalized = consent === 'accepted';
  const native = isNativeApp();

  // 네이티브 앱에서는 AdMob 배너를 화면 하단에 띄웁니다.
  // 이 배너는 웹뷰 위에 겹쳐 그려지므로 여기서는 자리만 비워둡니다.
  useEffect(() => {
    if (isPaid || !native) return undefined;
    void showBanner(placement);
    return () => {
      void hideBanner();
    };
  }, [isPaid, native, placement]);

  if (isPaid) return null;

  // 네이티브에서는 AdMob 배너가 웹뷰 위에 겹쳐 뜹니다.
  // 가려짐은 index.css 의 --mebody-ad-inset 여백이 처리하므로 여기서는 아무것도 그리지 않습니다.
  if (native) return null;

  return (
    <section
      data-ad-placement={placement}
      data-ad-personalized={personalized ? '1' : '0'}
      style={{
        borderRadius: '20px',
        border: `1px dashed ${AXIS_GREEN_THEME.border}`,
        background: 'rgba(255,255,255,0.72)',
        padding: '16px 16px 14px',
      }}
    >
      {/* 광고 표기는 법적으로 필요합니다(표시광고법). 콘텐츠와 구분되게 둡니다. */}
      <div style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em', color: '#9ca3af', marginBottom: '8px' }}>
        AD · 광고
      </div>

      {house ? (
        <button
          type="button"
          onClick={house.onClick}
          disabled={!house.onClick}
          style={{
            display: 'block',
            width: '100%',
            border: 'none',
            background: 'transparent',
            padding: 0,
            textAlign: 'left',
            fontFamily: 'inherit',
            cursor: house.onClick ? 'pointer' : 'default',
          }}
        >
          <div style={{ fontSize: '15px', fontWeight: 900, color: '#111827', marginBottom: '4px', wordBreak: 'keep-all' }}>
            {house.title}
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.6, fontWeight: 700, color: '#6b7280', wordBreak: 'keep-all' }}>
            {house.body}
          </div>
        </button>
      ) : (
        <div style={{ height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#c4c9cf' }}>
          광고 영역
        </div>
      )}

      <div style={{ marginTop: '10px', fontSize: '11px', lineHeight: 1.5, fontWeight: 700, color: '#9ca3af', wordBreak: 'keep-all' }}>
        멤버십에 가입하면 광고 없이 이용할 수 있습니다.
      </div>
    </section>
  );
}
