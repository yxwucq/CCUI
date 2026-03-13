import type { UsageSummary } from '@ccui/shared';
import type { SessionUsageSummary } from '../stores/sessionStore';
import type { SessionUsageRow } from '../stores/usageStore';

export async function fetchUsageSummary(range: string, sessionId?: string | null): Promise<UsageSummary> {
  const params = new URLSearchParams({ range });
  if (sessionId) params.set('sessionId', sessionId);
  const res = await fetch(`/api/usage/summary?${params}`);
  return res.json();
}

export async function fetchDailyUsage(range: string, sessionId?: string | null): Promise<any[]> {
  const params = new URLSearchParams({ range });
  if (sessionId) params.set('sessionId', sessionId);
  const res = await fetch(`/api/usage/daily?${params}`);
  return res.json();
}

export async function fetchModelUsage(sessionId?: string | null): Promise<any[]> {
  const params = sessionId ? `?sessionId=${sessionId}` : '';
  const res = await fetch(`/api/usage/models${params}`);
  return res.json();
}

export async function fetchPerSessionUsage(range?: string): Promise<SessionUsageRow[]> {
  const params = range ? `?range=${range}` : '';
  const res = await fetch(`/api/usage/per-session${params}`);
  return res.json();
}

export async function fetchSessionUsageSummary(sessionId: string): Promise<SessionUsageSummary> {
  const res = await fetch(`/api/usage/session-summary?sessionId=${sessionId}`);
  return res.json();
}
