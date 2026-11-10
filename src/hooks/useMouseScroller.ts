import { useEffect, useRef } from 'react';

import { MouseScroller, type MouseScrollerOptions } from '@/lib/MouseScroller';

/**
 * Creates a MouseScroller for `elRef` and returns stable `enable`/`disable`
 * callbacks.  The scroller is destroyed when the component unmounts.
 */
export function useMouseScroller(
  elRef: React.RefObject<HTMLElement | null>,
  options: MouseScrollerOptions,
): { enable: () => void; disable: () => void } {
  const scrollerRef = useRef<MouseScroller | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    scrollerRef.current = new MouseScroller(el, optionsRef.current);
    return () => {
      scrollerRef.current?.destroy();
      scrollerRef.current = null;
    };
  }, [elRef]);

  const enable = () => scrollerRef.current?.enable();
  const disable = () => scrollerRef.current?.disable();

  return { enable, disable };
}
