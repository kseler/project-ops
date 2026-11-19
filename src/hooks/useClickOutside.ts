import { type RefObject, useEffect, useRef } from 'react';

export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
  active = true,
) {
  const callbackRef = useRef(onOutside);
  callbackRef.current = onOutside;

  useEffect(() => {
    if (!active) return;

    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) callbackRef.current();
    };

    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [ref, active]);
}
