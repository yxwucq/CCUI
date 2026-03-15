import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAgentStore } from '../stores/agentStore';
import { getAgentMeta } from '../agentMeta';

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
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold">{id ? 'Edit Agent' : 'New Agent'}</h2>

      {!id && templates.length > 0 && (
        <div>
          <label className="block text-sm text-cc-text-secondary mb-2">Start from template</label>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {templates.map((t, i) => {
              const meta = getAgentMeta(t.name);
              return (
                <button
                  key={i}
                  onClick={() => handleTemplate(i)}
                  className={`flex-shrink-0 w-44 text-left rounded-lg border p-3 transition-all hover:brightness-110 ${
                    name === t.name ? `${meta.bg} ${meta.border}` : 'bg-cc-bg-surface border-cc-border'
                  }`}
                >
                  <div className="text-xl mb-1.5">{meta.emoji}</div>
                  <div className={`text-xs font-semibold mb-1 ${name === t.name ? meta.color : 'text-cc-text-secondary'}`}>
                    {t.name}
                  </div>
                  <div className="text-xs text-cc-text-muted line-clamp-2 leading-relaxed">
                    {t.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm text-cc-text-secondary mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-cc-bg-surface border border-cc-border rounded px-3 py-2 text-sm w-full focus:border-cc-accent focus:outline-none"
          placeholder="Agent name"
        />
      </div>

      <div>
        <label className="block text-sm text-cc-text-secondary mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-cc-bg-surface border border-cc-border rounded px-3 py-2 text-sm w-full resize-none focus:border-cc-accent focus:outline-none"
          rows={2}
          placeholder="What does this agent do?"
        />
      </div>

      <div>
        <label className="block text-sm text-cc-text-secondary mb-1">System Prompt</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="bg-cc-bg-surface border border-cc-border rounded px-3 py-2 text-sm w-full resize-none focus:border-cc-accent focus:outline-none font-mono"
          rows={8}
          placeholder="Instructions for the agent..."
        />
      </div>

      <div>
        <label className="block text-sm text-cc-text-secondary mb-1">Allowed Tools</label>
        <div className="flex flex-wrap gap-2">
          {ALL_TOOLS.map((tool) => (
            <button
              key={tool}
              onClick={() => toggleTool(tool)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                allowedTools.includes(tool)
                  ? 'bg-cc-accent-muted border-cc-accent text-cc-accent'
                  : 'bg-cc-bg-surface border-cc-border text-cc-text-muted hover:text-cc-text'
              }`}
            >
              {tool}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="text-sm text-cc-text-secondary">Max Turns</label>
          <span className="text-xs text-cc-text-muted">max tool-use loops per message; leave empty for no limit</span>
        </div>
        <input
          type="number"
          value={maxTurns || ''}
          onChange={(e) => setMaxTurns(e.target.value ? Number(e.target.value) : undefined)}
          className="bg-cc-bg-surface border border-cc-border rounded px-3 py-2 text-sm w-32 focus:border-cc-accent focus:outline-none"
          placeholder="No limit"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={!name || !systemPrompt}
          className="bg-cc-accent hover:bg-cc-accent-hover disabled:opacity-50 px-6 py-2 rounded-lg text-sm transition-colors"
        >
          {id ? 'Update' : 'Create'}
        </button>
        <button
          onClick={() => navigate('/agents')}
          className="bg-cc-bg-surface hover:bg-cc-bg-overlay px-6 py-2 rounded-lg text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
