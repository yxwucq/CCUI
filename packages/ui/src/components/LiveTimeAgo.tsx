import { useLiveTick } from '../hooks/useLiveTick';
import { timeAgo } from '../utils';

interface Props {
  iso: string;
  className?: string;
}

/** Renders a relative time string that auto-updates every 30 seconds. */
export default function LiveTimeAgo({ iso, className }: Props) {
  useLiveTick(30_000);
  return <span className={className}>{timeAgo(iso)}</span>;
}
