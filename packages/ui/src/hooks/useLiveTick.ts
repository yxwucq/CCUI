import { useState, useEffect } from 'react';

/** Increments a counter at the given interval to force re-renders (e.g. for live timestamps). */
export function useLiveTick(intervalMs = 30_000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}
