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
import { useOnline } from '../../utils/useOnline';

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
  const online = useOnline();
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
    // 복원은 **딱 한 번만** 씁니다.
    //
    // 예전에는 내용이 자랄 때마다(ResizeObserver 가 부를 때마다) scrollTop 을 밀어 넣고,
    // 내용이 충분히 길어졌을 때 비로소 멈췄습니다. 한 번 복원하는 데 수십 번을 썼습니다.
    // 그 반복이 안드로이드 WebView 합성기와 싸워서, 마켓 탭으로 **돌아올 때** 화면이
    // 깨졌습니다(실측: 첫 진입은 멀쩡, 스크롤 후 다른 탭 갔다 복귀하면 깨짐).
    //
    // 그래서 내용이 그 위치까지 자란 뒤에 한 번 쓰고 끝냅니다. 끝내 안 자라면
    // (상품이 줄었다거나) 맨 위에 있는 게 맞습니다 — 억지로 밀어 넣지 않습니다.
    const restore = () => {
      if (!restoringRef.current) return;
      if (element.scrollHeight - element.clientHeight < targetTopRef.current) return;
      element.scrollTop = targetTopRef.current;
      restoringRef.current = false;
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
    // 끝내 그 길이가 안 되면 복원을 포기합니다. 그래야 그 뒤의 저장이 다시 동작합니다.
    const giveUp = window.setTimeout(() => { restoringRef.current = false; }, 2500);
    const observer = new ResizeObserver(restore);
    if (contentRef.current) observer.observe(contentRef.current);
    element.addEventListener('scroll', save);
    element.addEventListener('wheel', userScroll, { passive: true });
    element.addEventListener('touchstart', userScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.clearTimeout(giveUp);
      window.clearTimeout(saveTimer);
      element.removeEventListener('scroll', save);
      element.removeEventListener('wheel', userScroll);
      element.removeEventListener('touchstart', userScroll);
    };
  }, [scrollKey]);

  // 신호가 올라오면 저장된 위치를 지우고 맨 위로. 같은 탭을 다시 눌렀을 때도 동작합니다.
  //
  // **신호가 실제로 올라갔을 때만** 합니다. 예전에는 값이 0 이 아니기만 하면 동작했는데,
  // 이 효과는 scrollKey 가 바뀔 때도 다시 돕니다. 그래서 홈 탭을 한 번이라도 누른 뒤에는
  // **탭을 옮길 때마다** 그 탭의 저장된 위치가 지워지고 맨 위로 튕겼습니다.
  // (실측: 마켓에서 827px 까지 내리고 홈 갔다 오면 저장값이 통째로 사라져 있었습니다.)
  const lastSignalRef = useRef(scrollTopSignal);
  useEffect(() => {
    if (scrollTopSignal === lastSignalRef.current) return;
    lastSignalRef.current = scrollTopSignal;
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

      {/* 연결이 끊기면 **끊겼다고 말합니다.**
          예전에는 아무 표시가 없어서, 화면이 비거나 "결과가 없다" 고 나오면
          사용자는 앱이 고장 난 줄 알았습니다(테스터 체험기 1-2). */}
      {!online && (
        <div
          role="status"
          style={{
            flexShrink: 0,
            padding: '8px 18px',
            background: 'var(--mebody-mint, #E8F3EC)',
            borderBottom: '1px solid rgba(1,71,37,0.10)',
            color: BRAND.green,
            fontSize: '0.8125rem',
            fontWeight: 800,
            textAlign: 'center',
          }}
        >
          연결이 끊겼어요 · 저장된 기록은 그대로 있습니다
        </div>
      )}

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

      {/* 마켓에서는 띄우지 않습니다.
          떠 있는 ⌄ 버튼이 오른쪽 열 상품의 담기(+) 버튼과 같은 자리에 겹쳐서
          살 수 있는 버튼을 가렸습니다(테스터 체험기 3-3).
          긴 상품 격자에서는 스크롤이 자명하므로 안내가 없어도 됩니다. */}
      {activeTab !== 'market' && (
        <ScrollIndicator containerRef={scrollRef} bottomOffset="calc(var(--mebody-tabbar-h) + 12px)" />
      )}
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
