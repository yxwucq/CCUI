import { create } from 'zustand';
import type { AgentConfig } from '@ccui/shared';

interface AgentStore {
  agents: AgentConfig[];
  templates: Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt'>[];
  fetchAgents: () => Promise<void>;
  fetchTemplates: () => Promise<void>;
  createAgent: (data: Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt'>) => Promise<AgentConfig>;
  updateAgent: (id: string, data: Partial<AgentConfig>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  templates: [],

  fetchAgents: async () => {
    const res = await fetch('/api/agents');
    const agents = await res.json();
    set({ agents });
  },

  fetchTemplates: async () => {
    const res = await fetch('/api/agents/templates');
    const templates = await res.json();
    set({ templates });
  },

  createAgent: async (data) => {
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const agent = await res.json();
    set((s) => ({ agents: [agent, ...s.agents] }));
    return agent;
  },

  updateAgent: async (id, data) => {
    const res = await fetch(`/api/agents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const updated = await res.json();
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? updated : a)),
    }));
  },

  deleteAgent: async (id) => {
    await fetch(`/api/agents/${id}`, { method: 'DELETE' });
    set((s) => ({ agents: s.agents.filter((a) => a.id !== id) }));
  },
}));
