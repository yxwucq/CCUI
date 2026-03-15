import { useEffect, useMemo, useState } from 'react';
import type { GitCommit } from '@ccui/shared';
import { layoutCommits, type CommitEdge, type CommitNode } from '../utils/gitGraph';

const ROW_H = 28;
const COL_W = 18;
const NODE_R = 4;
const PAD_X = 6;

function edgePath(e: CommitEdge): string {
  const x1 = PAD_X + e.fromCol * COL_W + COL_W / 2;
  const y1 = e.fromRow * ROW_H + ROW_H / 2;
  const x2 = PAD_X + e.toCol * COL_W + COL_W / 2;
  const y2 = e.toRow * ROW_H + ROW_H / 2;
  if (x1 === x2) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const mid = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${mid} ${x2} ${mid} ${x2} ${y2}`;
}

function RefBadge({ value }: { value: string }) {
  if (value === 'HEAD') return null;
  if (value.startsWith('HEAD -> ')) {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] bg-cc-cyan-bg text-cc-cyan-text font-mono shrink-0">
        {value.slice(8)}
      </span>
    );
  }
  if (value.startsWith('tag: ')) {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] bg-cc-yellow-bg text-cc-yellow-text font-mono shrink-0">
        {value.slice(5)}
      </span>
    );
  }
  if (value.includes('/')) {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] bg-cc-bg-surface text-cc-text-muted font-mono shrink-0">
        {value}
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] bg-cc-blue-bg text-cc-blue-text font-mono shrink-0">
      {value}
    </span>
  );
}

function CommitRow({ node, graphWidth }: { node: CommitNode; graphWidth: number }) {
  const cx = PAD_X + node.column * COL_W + COL_W / 2;
  const cy = ROW_H / 2;
  const isMerge = node.parents.length > 1;

  return (
    <div className="flex items-center hover:bg-cc-bg-surface/50 cursor-default" style={{ height: ROW_H }}>
      {/* Node circle */}
      <svg width={graphWidth} height={ROW_H} className="shrink-0" style={{ minWidth: graphWidth }}>
        <circle
          cx={cx}
          cy={cy}
          r={isMerge ? NODE_R + 1 : NODE_R}
          fill={node.color}
          stroke={isMerge ? 'var(--cc-bg)' : 'none'}
          strokeWidth={1.5}
        />
      </svg>

      {/* Text content */}
      <div className="flex items-center gap-2 px-2 min-w-0 flex-1">
        <span className="text-[10px] font-mono text-cc-text-muted shrink-0 w-[3.5rem]">
          {node.short}
        </span>
        {node.refs.length > 0 && (
          <div className="flex gap-1 shrink-0">
            {node.refs.map((r) => <RefBadge key={r} value={r} />)}
          </div>
        )}
        <span className="text-xs text-cc-text-secondary truncate flex-1">{node.message}</span>
        <span className="text-[10px] text-cc-text-muted shrink-0 hidden xl:block">{node.author}</span>
        <span className="text-[10px] text-cc-text-muted shrink-0">
          {new Date(node.date).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

export default function GitLog() {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/projects/git/log?limit=150')
      .then((r) => r.json())
      .then((data) => { setCommits(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const { nodes, edges, maxColumn } = useMemo(() => layoutCommits(commits), [commits]);

  const graphWidth = PAD_X + (maxColumn + 1) * COL_W + PAD_X;
  const totalHeight = nodes.length * ROW_H;

  if (loading) return <div className="p-4 text-sm text-cc-text-muted">Loading…</div>;
  if (!nodes.length) return <div className="p-4 text-sm text-cc-text-muted">No commits found</div>;

  return (
    <div className="relative overflow-x-auto">
      {/* Edge SVG — full height, absolute, behind rows */}
      <svg
        className="absolute top-0 left-0 pointer-events-none"
        width={graphWidth}
        height={totalHeight}
        style={{ minWidth: graphWidth }}
      >
        {edges.map((edge, i) => (
          <path
            key={i}
            d={edgePath(edge)}
            stroke={edge.color}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
        ))}
      </svg>

      {/* Rows */}
      <div className="relative">
        {nodes.map((node) => (
          <CommitRow key={node.hash} node={node} graphWidth={graphWidth} />
        ))}
      </div>
    </div>
  );
}
