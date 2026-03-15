import type { Session, ChatMessage } from '@ccui/shared';

export async function fetchSessions(): Promise<Session[]> {
  const res = await fetch('/api/sessions');
  return res.json();
}

export async function createSession(
  projectPath: string,
  opts?: { agentId?: string; branch?: string; name?: string; skipPermissions?: boolean },
): Promise<Session> {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectPath, ...opts }),
  });
  const session = await res.json();
  if (!res.ok || session.error) {
    throw new Error(session.error || 'Failed to create session');
  }
  return session;
}

export async function fetchMessages(sessionId: string): Promise<ChatMessage[]> {
  const res = await fetch(`/api/sessions/${sessionId}/messages`);
  return res.json();
}

export async function resumeSession(sessionId: string): Promise<Session> {
  const res = await fetch(`/api/sessions/${sessionId}/resume`, { method: 'POST' });
  const session = await res.json();
  if (!res.ok || session.error) {
    throw new Error(session.error || 'Failed to resume session');
  }
  return session;
}

export async function stopSession(sessionId: string): Promise<void> {
  await fetch(`/api/sessions/${sessionId}/stop`, { method: 'POST' });
}

export async function terminateSession(
  sessionId: string,
  action?: 'check' | 'merge' | 'discard',
): Promise<any> {
  const res = await fetch(`/api/sessions/${sessionId}/terminate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
}
