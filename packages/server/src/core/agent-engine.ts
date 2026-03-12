import { v4 as uuid } from 'uuid';
import { getDB } from '../db/database.js';
import type { AgentConfig } from '@ccui/shared';

const TEMPLATES: Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Code Reviewer',
    description: 'Strict code review focusing on quality, security, and performance',
    systemPrompt:
      'You are a strict code reviewer. Focus on code quality, security vulnerabilities, performance issues, and adherence to best practices. Provide specific, actionable feedback with code examples.',
    allowedTools: ['Read', 'Glob', 'Grep', 'Bash'],
  },
  {
    name: 'Bug Fixer',
    description: 'Specialized in locating and fixing bugs',
    systemPrompt:
      'You are a debugging specialist. Systematically locate bugs by reading code, running tests, and analyzing error messages. Provide minimal, targeted fixes.',
    allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
  },
  {
    name: 'Docs Writer',
    description: 'Technical documentation and README expert',
    systemPrompt:
      'You are a technical documentation expert. Write clear, comprehensive documentation including README files, API docs, and inline comments. Follow the project\'s existing style.',
    allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
  },
  {
    name: 'Refactorer',
    description: 'Code structure optimization specialist',
    systemPrompt:
      'You are a code refactoring expert. Improve code structure, reduce duplication, and enhance maintainability while preserving behavior. Always ensure tests pass after changes.',
    allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
  },
];

class AgentEngine {
  createAgent(config: Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt'>): AgentConfig {
    const id = uuid();
    const now = new Date().toISOString();
    const agent: AgentConfig = { ...config, id, createdAt: now, updatedAt: now };
    const db = getDB();
    db.prepare(
      `INSERT INTO agents (id, name, description, system_prompt, allowed_tools, max_turns, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, agent.name, agent.description, agent.systemPrompt,
      JSON.stringify(agent.allowedTools), agent.maxTurns || null, now, now);
    return agent;
  }

  updateAgent(id: string, partial: Partial<AgentConfig>): AgentConfig | null {
    const db = getDB();
    const existing = this.getAgent(id);
    if (!existing) return null;

    const updated = { ...existing, ...partial, updatedAt: new Date().toISOString() };
    db.prepare(
      `UPDATE agents SET name=?, description=?, system_prompt=?, allowed_tools=?, max_turns=?, updated_at=? WHERE id=?`
    ).run(
      updated.name, updated.description, updated.systemPrompt,
      JSON.stringify(updated.allowedTools), updated.maxTurns || null, updated.updatedAt, id
    );
    return updated;
  }

  deleteAgent(id: string): boolean {
    const db = getDB();
    const result = db.prepare('DELETE FROM agents WHERE id = ?').run(id);
    return result.changes > 0;
  }

  getAgent(id: string): AgentConfig | null {
    const db = getDB();
    const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as any;
    return row ? this.mapAgent(row) : null;
  }

  listAgents(): AgentConfig[] {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all() as any[];
    return rows.map(this.mapAgent);
  }

  getTemplates() {
    return TEMPLATES;
  }

  private mapAgent(row: any): AgentConfig {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      systemPrompt: row.system_prompt,
      allowedTools: JSON.parse(row.allowed_tools || '[]'),
      maxTurns: row.max_turns || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const agentEngine = new AgentEngine();
