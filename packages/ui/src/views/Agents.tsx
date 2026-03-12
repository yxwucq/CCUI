import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgentStore } from '../stores/agentStore';
import { Plus, Trash2, Edit, Play } from 'lucide-react';
import { getAgentMeta } from '../agentMeta';

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
        {agents.map((agent) => {
          const meta = getAgentMeta(agent.name);
          return (
            <div
              key={agent.id}
              className={`rounded-lg border ${meta.border} bg-gray-900 overflow-hidden hover:brightness-110 transition-all`}
            >
              {/* Colored header */}
              <div className={`${meta.bg} px-4 py-3 flex items-center justify-between`}>
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl leading-none">{meta.emoji}</span>
                  <h3 className={`font-semibold text-sm ${meta.color}`}>{agent.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => navigate(`/agents/${agent.id}/edit`)}
                    className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors rounded"
                  >
                    <Edit size={13} />
                  </button>
                  <button
                    onClick={() => { if (confirm('Delete this agent?')) deleteAgent(agent.id); }}
                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors rounded"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-4 py-3 space-y-3">
                <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                  {agent.description}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex gap-1 flex-wrap">
                    {agent.allowedTools.slice(0, 4).map((tool) => (
                      <span key={tool} className="text-[10px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-500">
                        {tool}
                      </span>
                    ))}
                    {agent.allowedTools.length > 4 && (
                      <span className="text-[10px] text-gray-600">+{agent.allowedTools.length - 4}</span>
                    )}
                  </div>
                  <button
                    onClick={() => navigate(`/chat?agent=${agent.id}`)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded transition-colors ${meta.bg} ${meta.color} hover:brightness-125`}
                  >
                    <Play size={11} /> Use
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {agents.length === 0 && (
          <p className="text-gray-600 col-span-full text-center py-8">
            No agents yet. Create one or use a template.
          </p>
        )}
      </div>
    </div>
  );
}
