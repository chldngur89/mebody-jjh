/**
 * 시안의 .bottom-nav
 * .bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:min(430px,100%);
 *   height:72px;background:rgba(255,255,250,.97);border-top:1px solid #dfe5df;
 *   display:grid;grid-template-columns:repeat(5,1fr);z-index:30}
 * .bottom-nav button{color:#748179;font-size:11px}
 * .bottom-nav button.active{color:var(--green);font-weight:900}
 *
 * 아이콘은 시안의 CSS 도형 대신 lucide 를 씁니다(이미 의존성이고 의미가 더 분명합니다).
 */
import { Dumbbell, Home, ShoppingBag, Sparkles, UserRound } from 'lucide-react';
import { BRAND, SHELL } from '../../theme/brand';

export type AppTab = 'home' | 'mission' | 'routine' | 'market' | 'status';

const TABS: Array<{ key: AppTab; label: string; Icon: typeof Home }> = [
  { key: 'home', label: '홈', Icon: Home },
  { key: 'mission', label: '미션', Icon: Sparkles },
  { key: 'routine', label: '루틴', Icon: Dumbbell },
  { key: 'market', label: '마켓', Icon: ShoppingBag },
  { key: 'status', label: '내 상태', Icon: UserRound },
];

export function TabBar({ active, onChange }: { active: AppTab; onChange: (tab: AppTab) => void }) {
  return (
    <nav
      style={{
        // 시안과 동일하게 뷰포트 기준으로 고정합니다.
        // absolute 로 두면 부모 높이가 콘텐츠를 따라 늘어날 때 화면 밖으로 밀립니다.
        // .bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:min(430px,100%)}
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        width: `min(${SHELL.maxWidth}px, 100%)`,
        // 네이티브에서 AdMob 배너가 화면 맨 아래에 뜨므로 그 높이만큼 올라갑니다.
        bottom: 'var(--mebody-ad-inset, 0px)',
        height: `${SHELL.tabBarHeight}px`,
        background: SHELL.tabBarBg,
        backdropFilter: 'blur(8px)',
        borderTop: SHELL.tabBarBorder,
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        zIndex: 30,
      }}
    >
      {TABS.map(({ key, label, Icon }) => {
        const on = key === active;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-current={on ? 'page' : undefined}
            style={{
              border: 0,
              background: 'transparent',
              color: on ? BRAND.green : SHELL.tabInactive,
              fontWeight: on ? 900 : 600,
              fontSize: '11px',
              fontFamily: 'inherit',
              display: 'grid',
              placeItems: 'center',
              alignContent: 'center',
              gap: '4px',
              cursor: 'pointer',
            }}
          >
            <Icon size={20} strokeWidth={on ? 2.6 : 2} />
            <small style={{ fontSize: '11px' }}>{label}</small>
          </button>
        );
      })}
    </nav>
  );
}
