import type { FileActivity } from '@ccui/shared';

/** Map a tool name + input to a file operation, if applicable */
export function extractFileOp(tool: string, input: any): { op: FileActivity['op'] | null; path: string | null } {
  switch (tool) {
    case 'Read':
      return { op: 'read', path: input.file_path || input.path || null };
    case 'Write': case 'Edit': case 'MultiEdit':
      return { op: 'write', path: input.file_path || input.path || null };
    case 'LS': case 'Glob':
      return { op: 'read', path: input.path || input.pattern || null };
    case 'Grep':
      return { op: 'read', path: input.path || input.pattern || null };
    case 'Bash':
      return { op: 'exec', path: ((input.command as string) || '').slice(0, 80) };
    default:
      return { op: null, path: null };
  }
}

/**
 * Tracks streaming tool_use input buffers and resolves them into FileActivity
 * when a content_block_stop is received.
 */
export class FileActivityTracker {
  // key: `${sessionId}:${blockIndex}`
  private toolInputBuffers = new Map<string, { name: string; json: string }>();

  /** Called on content_block_start for tool_use blocks */
  trackToolStart(sessionId: string, blockIndex: number, toolName: string) {
    this.toolInputBuffers.set(`${sessionId}:${blockIndex}`, { name: toolName, json: '' });
  }

  /** Called on input_json_delta — appends partial JSON */
  appendInput(sessionId: string, blockIndex: number, partialJson: string) {
    const buf = this.toolInputBuffers.get(`${sessionId}:${blockIndex}`);
    if (buf) buf.json += partialJson;
  }

  /** Called on content_block_stop — resolves the buffer and returns FileActivity if applicable */
  resolve(sessionId: string, blockIndex: number): FileActivity | null {
    const key = `${sessionId}:${blockIndex}`;
    const buf = this.toolInputBuffers.get(key);
    if (!buf) return null;

    this.toolInputBuffers.delete(key);
    try {
      const input = JSON.parse(buf.json || '{}');
      const { op, path } = extractFileOp(buf.name, input);
      if (op && path) {
        return { op, path, tool: buf.name, timestamp: new Date().toISOString() };
      }
    } catch { /* malformed partial JSON, skip */ }
    return null;
  }

  /** Clear all buffers for a session (called on process exit) */
  clearSession(sessionId: string) {
    for (const key of this.toolInputBuffers.keys()) {
      if (key.startsWith(`${sessionId}:`)) this.toolInputBuffers.delete(key);
    }
  }
}
