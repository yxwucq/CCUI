import type { GitCommit } from '@ccui/shared';

const LANE_COLORS = [
  '#60a5fa', // blue-400
  '#34d399', // emerald-400
  '#f472b6', // pink-400
  '#fb923c', // orange-400
  '#a78bfa', // violet-400
  '#facc15', // yellow-400
  '#2dd4bf', // teal-400
  '#f87171', // red-400
];

export interface CommitNode extends GitCommit {
  row: number;
  column: number;
  color: string;
}

export interface CommitEdge {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  color: string;
}

export interface GitGraphLayout {
  nodes: CommitNode[];
  edges: CommitEdge[];
  maxColumn: number;
}

export function layoutCommits(commits: GitCommit[]): GitGraphLayout {
  if (!commits.length) return { nodes: [], edges: [], maxColumn: 0 };

  const hashToRow = new Map<string, number>();
  const hashToCol = new Map<string, number>();
  commits.forEach((c, i) => hashToRow.set(c.hash, i));

  // lanes[i] = hash we're "waiting for" in column i; null = free slot
  const lanes: (string | null)[] = [];

  for (let row = 0; row < commits.length; row++) {
    const { hash, parents } = commits[row];

    // Find which column this commit belongs to
    let col = lanes.indexOf(hash);
    if (col === -1) {
      col = lanes.indexOf(null);
      if (col === -1) {
        col = lanes.length;
        lanes.push(null);
      }
    }

    hashToCol.set(hash, col);

    // Free all lanes pointing to this commit
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] === hash) lanes[i] = null;
    }

    // First parent inherits this column
    if (parents.length > 0) lanes[col] = parents[0];

    // Additional parents (merge) get their own lane if not already tracked
    for (let pi = 1; pi < parents.length; pi++) {
      const p = parents[pi];
      if (lanes.includes(p)) continue;
      let free = lanes.indexOf(null);
      if (free === -1) { free = lanes.length; lanes.push(null); }
      lanes[free] = p;
    }
  }

  const nodes: CommitNode[] = commits.map((commit, row) => ({
    ...commit,
    row,
    column: hashToCol.get(commit.hash) ?? 0,
    color: LANE_COLORS[(hashToCol.get(commit.hash) ?? 0) % LANE_COLORS.length],
  }));

  const edges: CommitEdge[] = [];
  for (const node of nodes) {
    for (const parentHash of node.parents) {
      const toRow = hashToRow.get(parentHash);
      const toCol = hashToCol.get(parentHash);
      if (toRow !== undefined && toCol !== undefined) {
        edges.push({ fromRow: node.row, fromCol: node.column, toRow, toCol, color: node.color });
      }
    }
  }

  const maxColumn = Math.max(0, ...nodes.map((n) => n.column));
  return { nodes, edges, maxColumn };
}
