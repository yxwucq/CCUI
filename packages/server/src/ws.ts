import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { v4 as uuid } from 'uuid';
import { sessionManager } from './core/session-manager.js';
import { terminalManager } from './core/terminal-manager.js';
import { usageTracker } from './core/usage-tracker.js';
import { getDB } from './db/database.js';
import type { WSMessage } from '@ccui/shared';

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Track which clients are subscribed to which sessions
  const subscriptions = new Map<string, Set<WebSocket>>();

  function broadcast(sessionId: string, message: WSMessage) {
    const data = JSON.stringify(message);
    const sent = new Set<WebSocket>();
    // Send to session-specific subscribers
    const subs = subscriptions.get(sessionId);
    if (subs) {
      for (const ws of subs) {
        if (ws.readyState === WebSocket.OPEN) { ws.send(data); sent.add(ws); }
      }
    }
    // Also broadcast to global listeners (avoiding duplicates)
    const globals = subscriptions.get('*');
    if (globals) {
      for (const ws of globals) {
        if (ws.readyState === WebSocket.OPEN && !sent.has(ws)) ws.send(data);
      }
    }
  }

  // Wire up session manager events
  sessionManager.onOutput((sessionId, content, done) => {
    broadcast(sessionId, { type: 'chat:output', sessionId, content, done });
  });

  sessionManager.onError((sessionId, error) => {
    broadcast(sessionId, { type: 'chat:error', sessionId, error });
  });

  sessionManager.onStatus((sessionId, status, lastActiveAt) => {
    broadcast(sessionId, { type: 'session:status', sessionId, status, lastActiveAt });
  });

  sessionManager.onActivity((sessionId, activity) => {
    broadcast(sessionId, { type: 'session:activity', sessionId, activity });
  });

  sessionManager.onBranch((sessionId, branch) => {
    broadcast(sessionId, { type: 'session:branch', sessionId, branch });
  });

  sessionManager.onFileActivity((sessionId, activity) => {
    broadcast(sessionId, { type: 'file:activity', sessionId, ...activity });
  });

  // Start polling git branches
  sessionManager.startBranchPolling();

  usageTracker.onUsage((record) => {
    broadcast(record.sessionId, { type: 'usage:update', record });
  });

  // Save terminal conversation turns to DB and broadcast to clients
  terminalManager.onMessage((sessionId, userMsg, assistantMsg) => {
    const db = getDB();
    const now = new Date().toISOString();
    db.prepare('UPDATE sessions SET last_active_at = ? WHERE id = ?').run(now, sessionId);

    const userId = uuid();
    const asstId = uuid();
    db.prepare('INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)')
      .run(userId, sessionId, 'user', userMsg, now);
    db.prepare('INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)')
      .run(asstId, sessionId, 'assistant', assistantMsg, now);

    broadcast(sessionId, { type: 'chat:saved_message', sessionId, role: 'user', content: userMsg, id: userId, timestamp: now });
    broadcast(sessionId, { type: 'chat:saved_message', sessionId, role: 'assistant', content: assistantMsg, id: asstId, timestamp: now });
    broadcast(sessionId, { type: 'session:status', sessionId, status: 'idle', lastActiveAt: now });
  });

  // Wire up terminal events
  terminalManager.onOutput((sessionId, data) => {
    console.log(`[ws] terminal:output for ${sessionId.slice(0, 8)} (${data.length} bytes)`);
    broadcast(sessionId, { type: 'terminal:output', sessionId, data });
  });

  terminalManager.onExit((sessionId, code) => {
    broadcast(sessionId, { type: 'terminal:exit', sessionId, code });
  });

  // Terminal activity → same session:activity channel as chat mode
  terminalManager.onActivity((sessionId, activity) => {
    broadcast(sessionId, { type: 'session:activity', sessionId, activity });
  });

  wss.on('connection', (ws) => {
    // Subscribe to all by default
    if (!subscriptions.has('*')) subscriptions.set('*', new Set());
    subscriptions.get('*')!.add(ws);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as WSMessage;

        if (msg.type === 'chat:input') {
          // Subscribe to this session
          if (!subscriptions.has(msg.sessionId)) subscriptions.set(msg.sessionId, new Set());
          subscriptions.get(msg.sessionId)!.add(ws);
          sessionManager.sendMessage(msg.sessionId, msg.content);
        } else if (msg.type === 'session:create') {
          const session = sessionManager.createSession(msg.projectPath, {
            agentId: msg.agentId,
            branch: msg.branch,
            name: msg.name,
            skipPermissions: msg.skipPermissions,
            sessionType: msg.sessionType,
          });
          ws.send(JSON.stringify({ type: 'session:status', sessionId: session.id, status: 'active' }));
        } else if (msg.type === 'session:resume') {
          const session = sessionManager.resumeSession(msg.sessionId);
          if (!subscriptions.has(msg.sessionId)) subscriptions.set(msg.sessionId, new Set());
          subscriptions.get(msg.sessionId)!.add(ws);
          ws.send(JSON.stringify({ type: 'session:status', sessionId: session.id, status: 'active' }));
        } else if (msg.type === 'session:stop') {
          sessionManager.stopSession(msg.sessionId);
          terminalManager.kill(msg.sessionId);
        } else if (msg.type === 'session:terminate') {
          sessionManager.terminateSession(msg.sessionId, msg.action);
          terminalManager.kill(msg.sessionId);
        } else if (msg.type === 'session:delete') {
          terminalManager.kill(msg.sessionId);
          sessionManager.deleteSession(msg.sessionId);
        } else if (msg.type === 'terminal:create') {
          // Subscribe to this session
          if (!subscriptions.has(msg.sessionId)) subscriptions.set(msg.sessionId, new Set());
          subscriptions.get(msg.sessionId)!.add(ws);
          // Only create if no terminal exists yet — reuse existing PTY
          if (!terminalManager.has(msg.sessionId)) {
            const session = sessionManager.getSession(msg.sessionId);
            if (session) {
              const cwd = session.worktreePath || session.projectPath;
              const db = getDB();
              const row = db.prepare('SELECT claude_session_id FROM sessions WHERE id = ?').get(msg.sessionId) as any;
              const claudeSessionId = row?.claude_session_id;

              let ok: boolean;
              if (claudeSessionId) {
                // Resume existing Claude conversation
                ok = terminalManager.create(msg.sessionId, cwd, msg.cols, msg.rows, claudeSessionId, undefined, session.skipPermissions);
              } else {
                // First run — assign a new session ID so we can resume later
                const newId = uuid();
                db.prepare('UPDATE sessions SET claude_session_id = ? WHERE id = ?').run(newId, msg.sessionId);
                ok = terminalManager.create(msg.sessionId, cwd, msg.cols, msg.rows, undefined, newId, session.skipPermissions);
              }
              if (!ok) {
                ws.send(JSON.stringify({ type: 'chat:error', sessionId: msg.sessionId, error: 'Failed to create terminal' }));
              }
            } else {
              ws.send(JSON.stringify({ type: 'chat:error', sessionId: msg.sessionId, error: 'Session not found' }));
            }
          }
        } else if (msg.type === 'terminal:input') {
          terminalManager.write(msg.sessionId, msg.data);
        } else if (msg.type === 'terminal:resize') {
          terminalManager.resize(msg.sessionId, msg.cols, msg.rows);
        }
      } catch (err: any) {
        ws.send(JSON.stringify({ type: 'chat:error', sessionId: '', error: err.message }));
      }
    });

    ws.on('close', () => {
      for (const [, subs] of subscriptions) {
        subs.delete(ws);
      }
    });
  });

  return wss;
}
