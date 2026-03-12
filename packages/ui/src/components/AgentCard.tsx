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
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <Bot size={18} className="text-blue-400" />
        <h3 className="font-medium">{agent.name}</h3>
      </div>
      <p className="text-sm text-gray-500 line-clamp-2">{agent.description}</p>
      <div className="mt-3 flex gap-2">
        <button onClick={onUse} className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">
          Use
        </button>
        <button onClick={onEdit} className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">
          Edit
        </button>
        <button onClick={onDelete} className="text-xs bg-red-600/20 text-red-400 px-2 py-1 rounded">
          Delete
        </button>
      </div>
    </div>
  );
}
