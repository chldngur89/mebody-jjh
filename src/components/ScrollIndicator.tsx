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
    <div
      className="animate-bounce"
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        left: '50%',
        marginLeft: '-22px', // width 44px 의 절반
        zIndex: 50,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '44px',
        height: '44px',
        borderRadius: '999px',
        background: 'rgba(255, 255, 255, 0.95)',
        boxShadow: '0 8px 16px rgba(5, 150, 105, 0.15)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
      }}
    >
      <ChevronDown size={24} color="#059669" strokeWidth={3} />
    </div>
  );
}
