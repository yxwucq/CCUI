import { useEffect, useRef, useState } from 'react';

/**
 * Measures the height of a container element via ResizeObserver.
 * Returns [ref, height] — attach ref to the element you want to measure.
 * Starts at Infinity so widgets render their full (lg) content before first measurement.
 */
export function useContainerHeight(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(Infinity);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setHeight(entries[0].contentRect.height);
    });
    ro.observe(el);
    setHeight(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, []);

  return [ref, height];
}

/** Derives effective render size from user config + actual container height. */
export function effectiveSize(configured: 'sm' | 'lg', containerHeight: number): 'sm' | 'lg' {
  if (configured === 'lg' && containerHeight < 130) return 'sm';
  return configured;
}
