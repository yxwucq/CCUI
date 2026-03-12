import { useEffect, useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useToastStore } from '../stores/toastStore';
import type { WSMessage } from '@ccui/shared';

// Module-level singleton WebSocket
let ws: WebSocket | null = null;
let wsStatus: 'connecting' | 'connected' | 'disconnected' = 'disconnected';
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let reconnectDelay = 1000;
let statusListeners = new Set<(s: typeof wsStatus) => void>();

function setWsStatus(s: typeof wsStatus) {
  wsStatus = s;
  statusListeners.forEach((fn) => fn(s));
}

function handleMessage(msg: WSMessage) {
  const s = useSessionStore.getState();
  switch (msg.type) {
    case 'chat:output':
      if (msg.done) {
        s.finalizeStream(msg.sessionId);
      } else {
        s.appendStreamChunk(msg.sessionId, msg.content);
      }
      break;
    case 'chat:error': {
      const errSession = s.sessions.find((sess) => sess.id === msg.sessionId);
      useToastStore.getState().addToast('error', errSession?.name ?? 'Session error', msg.error);
      s.appendMessage(msg.sessionId, {
        id: crypto.randomUUID(),
        sessionId: msg.sessionId,
        role: 'system',
        content: `Error: ${msg.error}`,
        timestamp: new Date().toISOString(),
      });
      break;
    }
    case 'session:status': {
      const prevStatus = s.sessions.find((sess) => sess.id === msg.sessionId)?.status;
      s.updateSessionStatus(msg.sessionId, msg.status, msg.lastActiveAt);
      if (prevStatus === 'active' && msg.status === 'idle') {
        const doneSession = s.sessions.find((sess) => sess.id === msg.sessionId);
        const usage = s.sessionUsage[msg.sessionId];
        useToastStore.getState().addToast(
          'success',
          `${doneSession?.name ?? 'Session'} completed`,
          usage ? `Cost: $${usage.totalCost.toFixed(4)}` : undefined,
        );
      }
      break;
    }
    case 'session:activity':
      s.updateActivity(msg.sessionId, msg.activity);
      break;
    case 'usage:update':
      s.updateSessionUsage(msg.record.sessionId, msg.record);
      break;
    case 'file:activity':
      s.addFileActivity(msg.sessionId, { op: msg.op, path: msg.path, tool: msg.tool, timestamp: msg.timestamp });
      break;
    case 'session:branch':
      s.updateSessionBranch(msg.sessionId, msg.branch);
      break;
    case 'chat:saved_message':
      s.appendMessage(msg.sessionId, {
        id: msg.id,
        sessionId: msg.sessionId,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      });
      break;
    case 'terminal:output':
      window.dispatchEvent(new CustomEvent('terminal:output', {
        detail: { sessionId: msg.sessionId, data: msg.data },
      }));
      break;
    case 'terminal:clear':
      window.dispatchEvent(new CustomEvent('terminal:clear', {
        detail: { sessionId: msg.sessionId },
      }));
      break;
    case 'terminal:exit':
      window.dispatchEvent(new CustomEvent('terminal:exit', {
        detail: { sessionId: msg.sessionId, code: msg.code },
      }));
      break;
  }
}

function connect() {
  // Guard against both OPEN and CONNECTING to prevent duplicate connections (React Strict Mode)
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
  ws = socket;
  setWsStatus('connecting');

  socket.onopen = () => {
    // If we've been replaced by a newer socket, close ourselves
    if (ws !== socket) { socket.close(); return; }
    setWsStatus('connected');
    reconnectDelay = 1000;
  };

  socket.onmessage = (event) => {
    if (ws !== socket) return; // stale socket
    try {
      const msg = JSON.parse(event.data) as WSMessage;
      handleMessage(msg);
    } catch { /* ignore invalid messages */ }
  };

  socket.onclose = () => {
    if (ws !== socket) return; // stale socket closing, ignore
    setWsStatus('disconnected');
    ws = null;
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
      connect();
    }, reconnectDelay);
  };

  socket.onerror = () => {
    socket.close();
  };
}

/** Send a WS message — can be called from anywhere, no hook needed */
export function sendWsMessage(msg: WSMessage) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    console.warn('[ws] message dropped, ws not open:', msg.type, 'readyState:', ws?.readyState);
  }
}

/**
 * Hook that initializes the singleton WebSocket connection.
 * Call this ONCE in MainLayout. Returns connection status for display.
 */
export function useWebSocket() {
  const [status, setStatus] = useState<typeof wsStatus>(wsStatus);

  useEffect(() => {
    statusListeners.add(setStatus);
    connect();
    return () => {
      statusListeners.delete(setStatus);
    };
  }, []);

  return { status, sendMessage: sendWsMessage };
}
