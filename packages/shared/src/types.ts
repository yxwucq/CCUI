// Session
export interface Session {
  id: string;
  name: string;
  projectPath: string;
  branch?: string;
  worktreePath?: string;
  agentId?: string;
  status: 'active' | 'idle' | 'terminated';
  createdAt: string;
  lastActiveAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  tokenCount?: number;
  cost?: number;
}

// Agent
export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[];
  maxTurns?: number;
  createdAt: string;
  updatedAt: string;
}

// Usage
export interface UsageRecord {
  id: string;
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  model: string;
  timestamp: string;
}

export interface UsageSummary {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  sessionCount: number;
  dailyBreakdown: { date: string; cost: number; tokens: number }[];
}

// Project
export interface ProjectInfo {
  path: string;
  name: string;
  gitBranch?: string;
  gitStatus?: GitFileStatus[];
  claudeMd?: string;
  fileCount: number;
  lastModified: string;
}

export interface GitFileStatus {
  file: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked';
}

// Session activity
export type SessionActivity =
  | { state: 'idle' }
  | { state: 'thinking'; preview: string }
  | { state: 'writing'; preview: string }
  | { state: 'tool_use'; tool: string; preview: string };

// WebSocket messages
export type WSMessage =
  | { type: 'chat:input'; sessionId: string; content: string }
  | { type: 'chat:output'; sessionId: string; content: string; done: boolean }
  | { type: 'chat:error'; sessionId: string; error: string }
  | { type: 'session:status'; sessionId: string; status: Session['status'] }
  | { type: 'session:activity'; sessionId: string; activity: SessionActivity }
  | { type: 'session:branch'; sessionId: string; branch: string }
  | { type: 'session:create'; projectPath: string; branch?: string; name?: string; agentId?: string }
  | { type: 'session:resume'; sessionId: string }
  | { type: 'session:terminate'; sessionId: string }
  | { type: 'usage:update'; record: UsageRecord }
  | { type: 'file:changed'; path: string; event: string }
  // Terminal (interactive Claude CLI)
  | { type: 'terminal:create'; sessionId: string; cols: number; rows: number }
  | { type: 'terminal:input'; sessionId: string; data: string }
  | { type: 'terminal:output'; sessionId: string; data: string }
  | { type: 'terminal:clear'; sessionId: string }
  | { type: 'terminal:resize'; sessionId: string; cols: number; rows: number }
  | { type: 'terminal:exit'; sessionId: string; code: number };
