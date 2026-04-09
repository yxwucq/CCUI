/**
 * CLI provider configurations for Claude Code and OpenAI Codex.
 * Each provider encapsulates the binary name, flag construction, usage file
 * path resolution, usage line parsing, and terminal output pattern matching.
 */
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';
import type { CliProviderType } from '@ccui/shared';

const require = createRequire(import.meta.url);

export interface CliProviderConfig {
  type: CliProviderType;
  binary: string;

  /** Build CLI args for spawning. */
  buildArgs(opts: {
    resumeId?: string;
    newSessionId?: string;
    skipPermissions?: boolean;
  }): string[];

  /** Env var overrides before spawn */
  envSetup(env: Record<string, string>): void;

  /** Terminal output patterns */
  patterns: {
    /** Regex to detect tool use from terminal output */
    toolPrefix: RegExp;
    /** Patterns indicating CLI is waiting for user input */
    inputPrompts: RegExp[];
    /** Character prefix for agent messages in terminal output */
    agentMarker: string;
  };
}

export const CLAUDE_PROVIDER: CliProviderConfig = {
  type: 'claude',
  binary: 'claude',

  buildArgs({ resumeId, newSessionId, skipPermissions }) {
    const args: string[] = [];
    if (skipPermissions) args.push('--dangerously-skip-permissions');
    if (resumeId) args.push('--resume', resumeId);
    else if (newSessionId) args.push('--session-id', newSessionId);
    return args;
  },

  envSetup(env) {
    delete env.CLAUDECODE;
  },

  patterns: {
    toolPrefix: /⏺\s+([A-Z][a-zA-Z_]+)\b\s*(.*)/g,
    inputPrompts: [
      /do you want to proceed/i,
      /esc to cancel/i,
      /\d+\.\s*(yes|no|deny|allow|reject|skip)/i,
      /allow once/i,
      /allow always/i,
    ],
    agentMarker: '⏺',
  },
};

export const CODEX_PROVIDER: CliProviderConfig = {
  type: 'codex',
  binary: 'codex',

  buildArgs({ resumeId, skipPermissions }) {
    const args: string[] = [];
    if (resumeId) {
      // codex resume [OPTIONS] [SESSION_ID] — flags before session ID
      args.push('resume');
      if (skipPermissions) args.push('--dangerously-bypass-approvals-and-sandbox');
      else args.push('--full-auto');
      args.push(resumeId);
    } else {
      if (skipPermissions) args.push('--dangerously-bypass-approvals-and-sandbox');
      else args.push('--full-auto');
    }
    return args;
  },

  envSetup(_env) {
    // No special env cleanup needed for Codex
  },

  patterns: {
    toolPrefix: /⏺\s+([A-Z][a-zA-Z_]+)\b\s*(.*)/g, // Codex TUI doesn't expose tool names the same way; reuse Claude's for now
    inputPrompts: [
      /do you trust the contents/i,
      /do you want to proceed/i,
      /esc to cancel/i,
      /\d+\.\s*(yes|no|deny|allow|reject|skip)/i,
    ],
    agentMarker: '•',
  },
};

export function getProvider(type?: CliProviderType): CliProviderConfig {
  return type === 'codex' ? CODEX_PROVIDER : CLAUDE_PROVIDER;
}

/** Compute Claude CLI's project slug from a working directory path */
export function claudeSlug(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9-]/g, '-');
}

/** Get the JSONL file path for a Claude session */
export function claudeJsonlPath(cwd: string, sessionId: string): string {
  return join(homedir(), '.claude', 'projects', claudeSlug(cwd), `${sessionId}.jsonl`);
}

/**
 * Discover a Codex thread ID by querying Codex's state database.
 * Returns the most recent thread ID matching the given cwd, or null.
 */
/**
 * @param minCreatedAt — Unix timestamp (seconds). Only return threads created after this time.
 */
export function discoverCodexThreadId(cwd: string, minCreatedAt?: number): string | null {
  const dbPath = join(homedir(), '.codex', 'state_5.sqlite');
  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const query = minCreatedAt
      ? 'SELECT id FROM threads WHERE cwd = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 1'
      : 'SELECT id FROM threads WHERE cwd = ? ORDER BY created_at DESC LIMIT 1';
    const args = minCreatedAt ? [cwd, minCreatedAt] : [cwd];
    const row = db.prepare(query).get(...args) as { id: string } | undefined;
    db.close();
    return row?.id ?? null;
  } catch (err: any) {
    console.error(`[codex] discoverThreadId failed for ${cwd}:`, err?.message || err);
    return null;
  }
}

/**
 * Find the rollout file path for a Codex thread ID.
 * Searches ~/.codex/sessions/ recursively for a file matching the thread ID.
 */
export function findCodexRolloutPath(threadId: string): string | null {
  const sessionsDir = join(homedir(), '.codex', 'sessions');
  try {
    // Use find to locate the rollout file — glob by thread ID suffix
    const result = execSync(
      `find "${sessionsDir}" -name "*${threadId}.jsonl" -type f 2>/dev/null | head -1`,
      { encoding: 'utf8', timeout: 3000 }
    ).trim();
    return result || null;
  } catch {
    return null;
  }
}
