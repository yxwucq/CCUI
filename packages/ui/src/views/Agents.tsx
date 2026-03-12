import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgentStore } from '../stores/agentStore';
import { Bot, Plus, Trash2, Edit, Play } from 'lucide-react';

export default function Agents() {
  const { agents, fetchAgents, deleteAgent } = useAgentStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAgents();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Agents</h2>
        <button
          onClick={() => navigate('/agents/new')}
          className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus size={16} /> New Agent
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="bg-gray-900 rounded-lg border border-gray-800 p-4 hover:border-gray-700 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Bot size={18} className="text-blue-400" />
                <h3 className="font-medium">{agent.name}</h3>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => navigate(`/agents/${agent.id}/edit`)}
                  className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this agent?')) deleteAgent(agent.id);
                  }}
                  className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2 line-clamp-2">{agent.description}</p>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-1 flex-wrap">
                {agent.allowedTools.slice(0, 3).map((tool) => (
                  <span key={tool} className="text-xs bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">
                    {tool}
                  </span>
                ))}
                {agent.allowedTools.length > 3 && (
                  <span className="text-xs text-gray-600">+{agent.allowedTools.length - 3}</span>
                )}
              </div>
              <button
                onClick={() => navigate(`/chat?agent=${agent.id}`)}
                className="flex items-center gap-1 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 px-2 py-1 rounded transition-colors"
              >
                <Play size={12} /> Use
              </button>
            </div>
          </div>
        ))}
        {agents.length === 0 && (
          <p className="text-gray-600 col-span-full text-center py-8">
            No agents yet. Create one or use a template.
          </p>
        )}
      </div>
    </div>
  );
}
