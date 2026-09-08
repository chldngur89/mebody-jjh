import { useLayoutEffect, useRef } from 'react';

/** A sheet consumes one browser-back action before its parent screen. */
export function useOverlayBack(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const id = useRef(crypto.randomUUID()).current;
  useLayoutEffect(() => {
    if (!open) return;
    history.pushState({ ...history.state, mebodyOverlay: id }, '', location.href);
    const onPop = () => {
      if (history.state?.mebodyOverlay !== id) closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (history.state?.mebodyOverlay === id) {
        const { mebodyOverlay: _, ...state } = history.state;
        history.replaceState(state, '', location.href);
      }
    };
  }, [open, id]);
  return () => {
    if (history.state?.mebodyOverlay === id) history.back();
    else closeRef.current();
  };
}
