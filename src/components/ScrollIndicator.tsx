import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { isInAppBrowser, preferredScrollBehavior } from '../lib/viewport';

interface ScrollIndicatorProps {
  containerRef: React.RefObject<HTMLElement | null>;
  bottomOffset?: string;
  threshold?: number;
}

export function ScrollIndicator({ containerRef, bottomOffset = '24px', threshold = 20 }: ScrollIndicatorProps) {
  const [show, setShow] = useState(false);
  const calmMotion = isInAppBrowser();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const checkScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight > clientHeight + 10 && scrollTop + clientHeight < scrollHeight - threshold) {
        setShow(true);
      } else {
        setShow(false);
      }
    };

    checkScroll();
    container.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    window.visualViewport?.addEventListener('resize', checkScroll);
    const timer = setTimeout(checkScroll, 300);

    return () => {
      container.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
      window.visualViewport?.removeEventListener('resize', checkScroll);
      clearTimeout(timer);
    };
  }, [containerRef, threshold]);

  if (!show) return null;

  const scrollDown = () => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({
      top: Math.min(container.scrollTop + Math.max(120, container.clientHeight * 0.55), container.scrollHeight),
      behavior: preferredScrollBehavior(),
    });
  };

  return (
    <button
      type="button"
      aria-label="아래로 스크롤"
      onClick={scrollDown}
      className={calmMotion ? undefined : 'animate-bounce'}
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        right: '14px',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '40px',
        height: '40px',
        borderRadius: '999px',
        border: '1px solid rgba(1, 71, 37, 0.16)',
        background: 'rgba(255, 255, 255, 0.96)',
        boxShadow: '0 6px 14px rgba(5, 150, 105, 0.14)',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <ChevronDown size={18} color="#014725" strokeWidth={3} />
    </button>
  );
}
