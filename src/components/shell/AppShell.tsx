/**
 * 시안의 .app-shell — 상단바 + 스크롤 본문 + 하단 탭바
 *
 * .app-shell{width:min(430px,100%);min-height:100vh;margin:0 auto;background:var(--bg);
 *   padding-bottom:92px;box-shadow:0 0 50px rgba(0,0,0,.08)}
 * body{background:#eef1ec}
 *
 * 본문 하단 여백은 탭바 높이 + (네이티브에서) AdMob 배너 높이를 합산합니다.
 * 배너는 웹뷰 위에 겹쳐 뜨므로 여백이 없으면 콘텐츠를 가립니다.
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { BRAND, SHELL } from '../../theme/brand';
import { ScrollIndicator } from '../ScrollIndicator';
import { TabBar, type AppTab } from './TabBar';
import { TopBar } from './TopBar';

export type { AppTab };

export function AppShell({
  activeTab,
  scrollKey = activeTab,
  onTabChange,
  onBrandClick,
  topBarRight,
  children,
  /** 탭바를 숨길 때(전체화면 흐름) */
  hideTabBar = false,
}: {
  activeTab: AppTab;
  scrollKey?: string;
  onTabChange: (tab: AppTab) => void;
  onBrandClick?: () => void;
  topBarRight?: ReactNode;
  children: ReactNode;
  hideTabBar?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const key = `mebody:scroll:${scrollKey}`;
    let top = 0;
    try { top = Number(sessionStorage.getItem(key)) || 0; } catch { /* memory only */ }
    let restoring = true;
    const restore = () => {
      if (!restoring) return;
      element.scrollTop = top;
      if (element.scrollHeight - element.clientHeight >= top) restoring = false;
    };
    const save = () => {
      if (restoring) return;
      try { sessionStorage.setItem(key, String(element.scrollTop)); } catch { /* memory only */ }
    };
    const userScroll = () => { restoring = false; };
    restore();
    const observer = new ResizeObserver(restore);
    if (contentRef.current) observer.observe(contentRef.current);
    element.addEventListener('scroll', save);
    element.addEventListener('wheel', userScroll, { passive: true });
    element.addEventListener('touchstart', userScroll, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', save);
      element.removeEventListener('wheel', userScroll);
      element.removeEventListener('touchstart', userScroll);
    };
  }, [scrollKey]);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        // height:100% 는 부모에 확정 높이가 없으면 auto 가 되어 스크롤 영역이 안 잡힙니다.
        // 뷰포트에 직접 묶어 flex:1 스크롤러가 실제로 제한되게 합니다.
        height: '100dvh',
        maxHeight: '100dvh',
        background: BRAND.bg,
        overflow: 'hidden',
      }}
    >
      <TopBar onBrandClick={onBrandClick} right={topBarRight} />

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          // .page{padding:22px 18px 30px}
          padding: '22px 18px 30px',
          // 탭바 + 배너에 가리지 않도록. --mebody-ad-inset 은 src/lib/ads.ts 가 채웁니다.
          paddingBottom: hideTabBar
            ? 'calc(30px + var(--mebody-ad-inset, 0px))'
            : `calc(${SHELL.tabBarHeight + 24}px + var(--mebody-ad-inset, 0px))`,
        }}
      >
        <div ref={contentRef}>{children}</div>
      </div>

      <ScrollIndicator containerRef={scrollRef} bottomOffset={`${SHELL.tabBarHeight + 12}px`} />
      {!hideTabBar && <TabBar active={activeTab} onChange={onTabChange} />}
    </div>
  );
}
