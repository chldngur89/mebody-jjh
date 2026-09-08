import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface ScrollIndicatorProps {
  containerRef: React.RefObject<HTMLElement | null>;
  bottomOffset?: string;
  threshold?: number;
}

export function ScrollIndicator({ containerRef, bottomOffset = '24px', threshold = 20 }: ScrollIndicatorProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const checkScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // 여백이 10px 이상이고 현재 스크롤 위치가 하단에서 threshold 이상 떨어져 있을 때 표시
      if (scrollHeight > clientHeight + 10 && scrollTop + clientHeight < scrollHeight - threshold) {
        setShow(true);
      } else {
        setShow(false);
      }
    };

    checkScroll();
    container.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);

    // Initial check with delay to ensure content is fully rendered
    const timer = setTimeout(checkScroll, 300);

    return () => {
      container.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
      clearTimeout(timer);
    };
  }, [containerRef, threshold]);

  if (!show) return null;

  return (
    // 화면 한가운데 두면 본문 글자를 가립니다 — 실제로 멤버십 비교표의 값과
    // 결제 화면 안내 문구를 덮고 있었습니다. 오른쪽 아래로 비켜서 띄웁니다.
    <div
      className="animate-bounce"
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        right: '14px',
        zIndex: 20,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '34px',
        height: '34px',
        borderRadius: '999px',
        background: 'rgba(255, 255, 255, 0.92)',
        boxShadow: '0 6px 14px rgba(5, 150, 105, 0.14)',
        border: '1px solid rgba(1, 71, 37, 0.16)',
      }}
    >
      <ChevronDown size={18} color="#014725" strokeWidth={3} />
    </div>
  );
}
