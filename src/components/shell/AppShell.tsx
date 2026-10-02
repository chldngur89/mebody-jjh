/**
 * 시안의 .app-shell — 상단바 + 스크롤 본문 + 하단 탭바
 *
 * 높이는 100dvh/100vh 가 아니라 var(--mebody-app-height) 를 씁니다.
 * (카카오 인앱에서 visualViewport 로 잰 값 — src/lib/viewport.ts)
 *
 * 본문 하단 여백은 탭바 높이 + (네이티브에서) AdMob 배너 높이를 합산합니다.
 * 배너는 웹뷰 위에 겹쳐 뜨므로 여백이 없으면 콘텐츠를 가립니다.
 */
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { BRAND } from '../../theme/brand';
import { AdSlot } from '../AdSlot';
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
  /**
   * 값이 바뀌면 본문을 맨 위로 되돌립니다.
   * 홈 탭을 누를 때 쓰입니다 — 들어오면 오늘의 미션·루틴이 먼저 보여야 하는데,
   * 기본 동작은 탭별로 마지막 스크롤 위치를 복원하는 것이어서 중간부터 열립니다.
   */
  scrollTopSignal = 0,
  /**
   * 활성 구독이면 광고를 띄우지 않습니다.
   *
   * 배너를 **셸에 한 번만** 답니다. 예전에는 화면마다 AdSlot 을 달아서 탭을 옮길 때마다
   * 배너가 사라졌다 다시 떴습니다(AdSlot 이 언마운트되며 hideBanner 를 부릅니다).
   * 그때마다 하단 여백도 같이 출렁였습니다. 여기 한 곳에 두면 탭을 옮겨도 그대로 있습니다.
   */
  isPaid = false,
}: {
  activeTab: AppTab;
  scrollKey?: string;
  onTabChange: (tab: AppTab) => void;
  onBrandClick?: () => void;
  topBarRight?: ReactNode;
  children: ReactNode;
  scrollTopSignal?: number;
  isPaid?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  /**
   * 복원 상태를 **ref 로** 들고 있습니다. 두 효과가 같은 값을 봐야 하기 때문입니다.
   *
   * 예전에는 복원 로직 안의 지역 변수였습니다. 그래서 홈 탭을 눌러도 맨 위로 가지 않았습니다.
   *   ① 탭 변경 → scrollKey 바뀜 → 복원 효과가 저장된 위치를 목표로 잡음
   *   ② 신호 효과가 scrollTop = 0 으로 되돌림
   *   ③ **그런데 ResizeObserver 가 내용이 그려질 때마다 restore() 를 다시 부릅니다.**
   *      restore() 는 지역 변수에 남아 있는 옛 목표를 그대로 밀어 넣어 ②를 무효로 만듭니다.
   * 신호가 오면 "복원 중" 을 끄고 목표를 0 으로 바꿔야 그 되돌림이 멈춥니다.
   */
  const restoringRef = useRef(true);
  const targetTopRef = useRef(0);
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const key = `mebody:scroll:${scrollKey}`;
    let top = 0;
    try { top = Number(sessionStorage.getItem(key)) || 0; } catch { /* memory only */ }
    targetTopRef.current = top;
    restoringRef.current = true;
    const restore = () => {
      if (!restoringRef.current) return;
      element.scrollTop = targetTopRef.current;
      if (element.scrollHeight - element.clientHeight >= targetTopRef.current) restoringRef.current = false;
    };
    // 스크롤 위치 저장은 **스크롤이 멎은 뒤에** 합니다.
    // 예전에는 scroll 이벤트마다 sessionStorage 에 썼습니다. sessionStorage 쓰기는
    // 동기라 주 스레드를 잡고, 스크롤 한 번에 수십 번 불립니다. 복원에 필요한 건
    // 마지막 위치 하나뿐이라 매 프레임 쓸 이유가 없습니다.
    let saveTimer = 0;
    const save = () => {
      if (restoringRef.current) return;
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        try { sessionStorage.setItem(key, String(element.scrollTop)); } catch { /* memory only */ }
      }, 150);
    };
    const userScroll = () => { restoringRef.current = false; };
    restore();
    const observer = new ResizeObserver(restore);
    if (contentRef.current) observer.observe(contentRef.current);
    element.addEventListener('scroll', save);
    element.addEventListener('wheel', userScroll, { passive: true });
    element.addEventListener('touchstart', userScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.clearTimeout(saveTimer);
      element.removeEventListener('scroll', save);
      element.removeEventListener('wheel', userScroll);
      element.removeEventListener('touchstart', userScroll);
    };
  }, [scrollKey]);

  // 신호가 올라오면 저장된 위치를 지우고 맨 위로. 같은 탭을 다시 눌렀을 때도 동작합니다.
  useEffect(() => {
    if (!scrollTopSignal) return;
    try {
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith(`mebody:scroll:`) && key.endsWith(scrollKey)) sessionStorage.removeItem(key);
      }
    } catch { /* memory only */ }
    // 복원을 **멈춰야** 합니다. 끄지 않으면 ResizeObserver 가 바로 되돌려 놓습니다.
    restoringRef.current = false;
    targetTopRef.current = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [scrollTopSignal, scrollKey]);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        // height:100% 는 부모에 확정 높이가 없으면 auto 가 되어 스크롤 영역이 안 잡힙니다.
        // 뷰포트에 직접 묶어 flex:1 스크롤러가 실제로 제한되게 합니다.
        height: 'var(--mebody-app-height)',
        maxHeight: 'var(--mebody-app-height)',
        background: BRAND.bg,
        overflow: 'hidden',
        paddingTop: 'env(safe-area-inset-top)',
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
          paddingBottom: 'calc(var(--mebody-tabbar-h) + 24px + var(--mebody-ad-inset, 0px))',
        }}
      >
        <div ref={contentRef}>{children}</div>
      </div>

      <ScrollIndicator containerRef={scrollRef} bottomOffset="calc(var(--mebody-tabbar-h) + 12px)" />
      <TabBar active={activeTab} onChange={onTabChange} />
      {/*
          모든 탭에서 같은 배너가 같은 자리에 뜹니다.
          네이티브에서는 AdMob 이 웹뷰 위에 겹쳐 그리므로 여기서는 아무것도 그리지 않고
          띄우기/내리기만 맡습니다. 가려짐은 --mebody-ad-inset 여백이 처리합니다.
      */}
      <AdSlot isPaid={isPaid} placement="result_bottom" />
    </div>
  );
}
