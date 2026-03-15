import { Bot } from 'lucide-react';
import type { AgentConfig } from '@ccui/shared';

interface Props {
  agent: AgentConfig;
  onEdit: () => void;
  onDelete: () => void;
  onUse: () => void;
}

export default function AgentCard({ agent, onEdit, onDelete, onUse }: Props) {
  return (
    <div className="bg-cc-bg rounded-lg border border-cc-border p-4 hover:border-cc-border transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <Bot size={18} className="text-cc-blue-text" />
        <h3 className="font-medium">{agent.name}</h3>
      </div>
      <p className="text-sm text-cc-text-muted line-clamp-2">{agent.description}</p>
      <div className="mt-3 flex gap-2">
        <button onClick={onUse} className="text-xs bg-cc-green-bg text-cc-green-text px-2 py-1 rounded">
          Use
        </button>
        <button onClick={onEdit} className="text-xs bg-cc-bg-surface text-cc-text-secondary px-2 py-1 rounded">
          Edit
        </button>
        <button onClick={onDelete} className="text-xs bg-cc-red-bg text-cc-red-text px-2 py-1 rounded">
          Delete
        </button>
      </div>
    </div>
  );
}
