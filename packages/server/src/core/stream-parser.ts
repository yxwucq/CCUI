import { v4 as uuid } from 'uuid';
import { getDB } from '../db/database.js';
import { usageTracker } from './usage-tracker.js';
import { FileActivityTracker } from './file-activity-detector.js';
import type { SessionActivity, FileActivity } from '@ccui/shared';

export interface StreamCallbacks {
  emitOutput: (sessionId: string, content: string, done: boolean) => void;
  emitError: (sessionId: string, error: string) => void;
  emitActivity: (sessionId: string, activity: SessionActivity, immediate?: boolean) => void;
  emitFileActivity: (sessionId: string, activity: FileActivity) => void;
  getActivityTool: (sessionId: string) => string | undefined;
}

/**
 * Parses Claude CLI stream-json output lines and dispatches events.
 * Manages tool input buffers and model tracking per session.
 */
export class StreamParser {
  private fileTracker = new FileActivityTracker();
  private lastModel = new Map<string, string>();

  constructor(private cb: StreamCallbacks) {}

  handleLine(sessionId: string, line: string) {
    try {
      const msg = JSON.parse(line);
      const db = getDB();

      if (msg.type === 'system' && msg.subtype === 'init' && msg.session_id) {
        console.log(`[claude:${sessionId.slice(0, 8)}] captured claude session: ${msg.session_id}`);
        db.prepare('UPDATE sessions SET claude_session_id = ? WHERE id = ?')
          .run(msg.session_id, sessionId);
        return;
      }

      if (msg.type === 'content_block_start') {
        const blockType = msg.content_block?.type;
        if (blockType === 'thinking') {
          this.cb.emitActivity(sessionId, { state: 'thinking', preview: '' }, true);
        } else if (blockType === 'tool_use') {
          const toolName = msg.content_block?.name || 'tool';
          this.fileTracker.trackToolStart(sessionId, msg.index, toolName);
          this.cb.emitActivity(sessionId, { state: 'tool_use', tool: toolName, preview: '' }, true);
        } else if (blockType === 'text') {
          this.cb.emitActivity(sessionId, { state: 'writing', preview: '' }, true);
        }
      } else if (msg.type === 'content_block_delta') {
        const deltaType = msg.delta?.type;
        if (deltaType === 'thinking_delta' && msg.delta?.thinking) {
          const text = msg.delta.thinking;
          const preview = text.length > 80 ? '…' + text.slice(-80) : text;
          this.cb.emitActivity(sessionId, { state: 'thinking', preview });
        } else if (deltaType === 'input_json_delta' && msg.delta?.partial_json) {
          this.fileTracker.appendInput(sessionId, msg.index, msg.delta.partial_json);
          const tool = this.cb.getActivityTool(sessionId) || 'tool';
          const json = msg.delta.partial_json;
          const preview = json.length > 60 ? json.slice(0, 60) + '…' : json;
          this.cb.emitActivity(sessionId, { state: 'tool_use', tool, preview });
        } else if (msg.delta?.text) {
          const text = msg.delta.text;
          this.cb.emitOutput(sessionId, text, false);
          const preview = text.length > 80 ? '…' + text.slice(-80) : text;
          this.cb.emitActivity(sessionId, { state: 'writing', preview });
        }
      } else if (msg.type === 'content_block_stop') {
        const activity = this.fileTracker.resolve(sessionId, msg.index);
        if (activity) this.cb.emitFileActivity(sessionId, activity);
      } else if (msg.type === 'assistant' && msg.message) {
        if (msg.message.model) this.lastModel.set(sessionId, msg.message.model);
        const textBlocks = Array.isArray(msg.message.content)
          ? msg.message.content.filter((b: any) => b.type === 'text')
          : [];
        const content = typeof msg.message === 'string'
          ? msg.message
          : textBlocks.map((b: any) => b.text || '').join('');
        if (content) {
          const msgId = uuid();
          db.prepare(
            'INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)'
          ).run(msgId, sessionId, 'assistant', content, new Date().toISOString());
        }
      } else if (msg.type === 'result') {
        if (msg.usage) {
          const model = msg.model || this.lastModel.get(sessionId) || '';
          usageTracker.recordFromClaude(sessionId, msg.usage, model);
        }
        this.cb.emitOutput(sessionId, '', true);
        this.cb.emitActivity(sessionId, { state: 'idle' }, true);
      } else if (msg.type === 'error') {
        const content = msg.message || msg.error || JSON.stringify(msg);
        this.cb.emitError(sessionId, content);
      }
    } catch {
      if (line) this.cb.emitOutput(sessionId, line, false);
    }
  }

  clearSession(sessionId: string) {
    this.fileTracker.clearSession(sessionId);
    this.lastModel.delete(sessionId);
  }
}
