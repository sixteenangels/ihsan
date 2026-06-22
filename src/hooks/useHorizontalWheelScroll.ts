import { useEffect, type RefObject } from 'react';

export function useHorizontalWheelScroll<T extends HTMLElement>(ref: RefObject<T | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const element = ref.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      if (element.scrollWidth <= element.clientWidth) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

      event.preventDefault();
      element.scrollLeft += event.deltaY;
    };

    element.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      element.removeEventListener('wheel', handleWheel);
    };
  }, [enabled, ref]);
}
