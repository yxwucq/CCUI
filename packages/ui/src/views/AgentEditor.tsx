import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAgentStore } from '../stores/agentStore';

const ALL_TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Agent', 'WebSearch', 'WebFetch'];

export default function AgentEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { agents, templates, fetchTemplates, createAgent, updateAgent } = useAgentStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [maxTurns, setMaxTurns] = useState<number | undefined>();

  useEffect(() => {
    fetchTemplates();
    if (id) {
      const agent = agents.find((a) => a.id === id);
      if (agent) {
        setName(agent.name);
        setDescription(agent.description);
        setSystemPrompt(agent.systemPrompt);
        setAllowedTools(agent.allowedTools);
        setMaxTurns(agent.maxTurns);
      }
    }
  }, [id]);

  const handleTemplate = (idx: number) => {
    const t = templates[idx];
    if (!t) return;
    setName(t.name);
    setDescription(t.description);
    setSystemPrompt(t.systemPrompt);
    setAllowedTools(t.allowedTools);
  };

  const handleSave = async () => {
    if (!name || !systemPrompt) return;
    if (id) {
      await updateAgent(id, { name, description, systemPrompt, allowedTools, maxTurns });
    } else {
      await createAgent({ name, description, systemPrompt, allowedTools, maxTurns });
    }
    navigate('/agents');
  };

  const toggleTool = (tool: string) => {
    setAllowedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-bold">{id ? 'Edit Agent' : 'New Agent'}</h2>

      {!id && templates.length > 0 && (
        <div>
          <label className="block text-sm text-gray-400 mb-1">Start from template</label>
          <select
            onChange={(e) => handleTemplate(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm w-full"
            defaultValue=""
          >
            <option value="">Choose template...</option>
            {templates.map((t, i) => (
              <option key={i} value={i}>{t.name} - {t.description}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm text-gray-400 mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm w-full focus:border-blue-500 focus:outline-none"
          placeholder="Agent name"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm w-full resize-none focus:border-blue-500 focus:outline-none"
          rows={2}
          placeholder="What does this agent do?"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">System Prompt</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm w-full resize-none focus:border-blue-500 focus:outline-none font-mono"
          rows={8}
          placeholder="Instructions for the agent..."
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Allowed Tools</label>
        <div className="flex flex-wrap gap-2">
          {ALL_TOOLS.map((tool) => (
            <button
              key={tool}
              onClick={() => toggleTool(tool)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                allowedTools.includes(tool)
                  ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                  : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'
              }`}
            >
              {tool}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Max Turns (optional)</label>
        <input
          type="number"
          value={maxTurns || ''}
          onChange={(e) => setMaxTurns(e.target.value ? Number(e.target.value) : undefined)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm w-32 focus:border-blue-500 focus:outline-none"
          placeholder="No limit"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={!name || !systemPrompt}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-2 rounded-lg text-sm transition-colors"
        >
          {id ? 'Update' : 'Create'}
        </button>
        <button
          onClick={() => navigate('/agents')}
          className="bg-gray-800 hover:bg-gray-700 px-6 py-2 rounded-lg text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
