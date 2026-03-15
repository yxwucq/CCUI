/** Returns a Tailwind color class based on percentage thresholds (>80 red, >50 yellow, else green) */
export function pctBarColor(pct: number): string {
  return pct > 80 ? 'bg-cc-red-text' : pct > 50 ? 'bg-cc-yellow-text' : 'bg-cc-green-text';
}

/** Human-readable relative time string */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
