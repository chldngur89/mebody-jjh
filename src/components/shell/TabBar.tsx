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
      aria-label="주요 화면"
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
        // 홈 인디케이터에 탭이 깔리지 않도록 아래쪽 안전영역만큼 키우고 그만큼 패딩을 준다.
        // (box-sizing: border-box 이므로 버튼이 놓이는 안쪽 높이는 tabBarHeight 그대로)
        height: 'var(--mebody-tabbar-h)',
        // 배너가 떠 있으면 0 입니다(배너가 이미 제스처바 위에 앉습니다) — index.css 참고.
        paddingBottom: 'var(--mebody-tabbar-safe)',
        background: SHELL.tabBarBg,
        backdropFilter: 'blur(8px)',
        borderTop: SHELL.tabBarBorder,
        // 아래에 광고가 붙으면 탭바 밑에도 선을 그어 **앱과 광고를 가릅니다.**
        // 구분이 없으면 배너가 앱의 일부처럼 보이고, 표시광고법상으로도 광고임이
        // 드러나야 합니다. 광고가 없을 때는 선을 그리지 않습니다.
        borderBottom: 'var(--mebody-ad-divider, none)',
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
              fontSize: '0.75rem',
              fontFamily: 'inherit',
              display: 'grid',
              placeItems: 'center',
              alignContent: 'center',
              gap: '4px',
              cursor: 'pointer',
            }}
          >
            {/* 선택된 탭도 **선 색 그대로 채우지 않습니다.** 선과 같은 초록으로 안을 채우면
                아이콘이 초록 덩어리가 되어 집인지 가방인지 구분이 안 됐습니다.
                옅게만 채워 모양은 남기고 선택된 느낌만 더합니다. */}
            <Icon
              size={20}
              strokeWidth={on ? 2.4 : 2}
              fill={on ? 'rgba(1,71,37,0.14)' : 'none'}
            />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
