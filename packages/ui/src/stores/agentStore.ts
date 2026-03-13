import { create } from 'zustand';
import type { AgentConfig } from '@ccui/shared';
import * as agentsApi from '../api/agents';

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
    const agents = await agentsApi.fetchAgents();
    set({ agents });
  },

  fetchTemplates: async () => {
    const templates = await agentsApi.fetchAgentTemplates();
    set({ templates });
  },

  createAgent: async (data) => {
    const agent = await agentsApi.createAgent(data);
    set((s) => ({ agents: [agent, ...s.agents] }));
    return agent;
  },

  updateAgent: async (id, data) => {
    const updated = await agentsApi.updateAgent(id, data);
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? updated : a)),
    }));
  },

  deleteAgent: async (id) => {
    await agentsApi.deleteAgent(id);
    set((s) => ({ agents: s.agents.filter((a) => a.id !== id) }));
  },
}));
