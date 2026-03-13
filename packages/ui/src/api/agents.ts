import type { AgentConfig } from '@ccui/shared';

type AgentInput = Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt'>;

export async function fetchAgents(): Promise<AgentConfig[]> {
  const res = await fetch('/api/agents');
  return res.json();
}

export async function fetchAgentTemplates(): Promise<AgentInput[]> {
  const res = await fetch('/api/agents/templates');
  return res.json();
}

export async function createAgent(data: AgentInput): Promise<AgentConfig> {
  const res = await fetch('/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateAgent(id: string, data: Partial<AgentConfig>): Promise<AgentConfig> {
  const res = await fetch(`/api/agents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteAgent(id: string): Promise<void> {
  await fetch(`/api/agents/${id}`, { method: 'DELETE' });
}
