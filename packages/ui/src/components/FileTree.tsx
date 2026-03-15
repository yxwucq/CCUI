import { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

interface Props {
  nodes: TreeNode[];
  onSelect: (path: string) => void;
  selectedPath: string | null;
  depth?: number;
}

export default function FileTree({ nodes, onSelect, selectedPath, depth = 0 }: Props) {
  return (
    <div>
      {nodes.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          onSelect={onSelect}
          selectedPath={selectedPath}
          depth={depth}
        />
      ))}
    </div>
  );
}

function FileTreeNode({
  node,
  onSelect,
  selectedPath,
  depth,
}: {
  node: TreeNode;
  onSelect: (path: string) => void;
  selectedPath: string | null;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isDir = node.type === 'directory';
  const isSelected = node.path === selectedPath;

  return (
    <div>
      <button
        onClick={() => {
          if (isDir) setExpanded(!expanded);
          else onSelect(node.path);
        }}
        className={`w-full text-left flex items-center gap-1 px-2 py-0.5 text-sm rounded hover:bg-cc-bg-surface/50 transition-colors ${
          isSelected ? 'bg-cc-accent-muted text-cc-accent' : 'text-cc-text-secondary'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isDir ? (
          expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
        ) : (
          <span className="w-3.5" />
        )}
        {isDir ? (
          <Folder size={14} className="text-cc-yellow-text" />
        ) : (
          <File size={14} className="text-cc-text-muted" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isDir && expanded && node.children && (
        <FileTree
          nodes={node.children}
          onSelect={onSelect}
          selectedPath={selectedPath}
          depth={depth + 1}
        />
      )}
    </div>
  );
}
