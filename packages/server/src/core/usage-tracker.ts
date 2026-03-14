import { v4 as uuid } from 'uuid';
import { getDB } from '../db/database.js';
import type { UsageRecord, UsageSummary } from '@ccui/shared';

// Model pricing per million tokens (USD).
// Matched by prefix after stripping trailing date suffix (e.g. -20251101).
// Order matters: more specific prefixes must come before shorter ones.
const MODEL_PRICING = [
  // Opus 4.6 — $5 / $25 (fast mode: $30 / $150)
  { prefix: 'claude-opus-4-6',   price: { input: 5,    output: 25   }, fast: { input: 30, output: 150 } },
  // Opus 4.5 — $5 / $25
  { prefix: 'claude-opus-4-5',   price: { input: 5,    output: 25   } },
  // Opus 4.1 — $15 / $75
  { prefix: 'claude-opus-4-1',   price: { input: 15,   output: 75   } },
  // Opus 4.0 — $15 / $75
  { prefix: 'claude-opus-4',     price: { input: 15,   output: 75   } },
  // Sonnet 4.x — $3 / $15
  { prefix: 'claude-sonnet-4',   price: { input: 3,    output: 15   } },
  // Claude 3.5 Sonnet (claude-3-5-sonnet-...) — $3 / $15
  { prefix: 'claude-3-5-sonnet', price: { input: 3,    output: 15   } },
  // Haiku 4.5 — $1 / $5
  { prefix: 'claude-haiku-4-5',  price: { input: 1,    output: 5    } },
  // Haiku 4.x fallback — $1 / $5
  { prefix: 'claude-haiku-4',    price: { input: 1,    output: 5    } },
  // Claude 3.5 Haiku (claude-3-5-haiku-...) — $0.8 / $4
  { prefix: 'claude-3-5-haiku',  price: { input: 0.8,  output: 4    } },
  // Claude 3 Haiku (deprecated) — $0.25 / $1.25
  { prefix: 'claude-3-haiku',    price: { input: 0.25, output: 1.25 } },
];

function getPrice(model: string, speed?: string): { input: number; output: number } | null {
  const normalized = model.replace(/-\d{8}$/, '');
  for (const entry of MODEL_PRICING) {
    if (normalized.startsWith(entry.prefix)) {
      if (speed === 'fast' && 'fast' in entry) return entry.fast!;
      return entry.price;
    }
  }
  return null;
}

type UsageListener = (record: UsageRecord) => void;

class UsageTracker {
  private listeners: UsageListener[] = [];

  onUsage(listener: UsageListener) {
    this.listeners.push(listener);
  }

  recordFromClaude(sessionId: string, usage: any, model: string) {
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheRead = usage.cache_read_input_tokens || 0;
    const cacheWrite = usage.cache_creation_input_tokens || 0;
    const speed: string | undefined = usage.speed;
    const price = getPrice(model, speed);

    // Cache write cost: distinguish 5min (1.25x) vs 1h (2x) TTLs when available
    let cacheWriteCost = 0;
    if (price) {
      const cc = usage.cache_creation;
      if (cc && (cc.ephemeral_5m_input_tokens || cc.ephemeral_1h_input_tokens)) {
        const cache5m = cc.ephemeral_5m_input_tokens || 0;
        const cache1h = cc.ephemeral_1h_input_tokens || 0;
        cacheWriteCost = (cache5m * price.input * 1.25 + cache1h * price.input * 2.0) / 1_000_000;
      } else {
        // Fallback: no breakdown available, assume 1.25x
        cacheWriteCost = (cacheWrite * price.input * 1.25) / 1_000_000;
      }
    }

    const cost = price
      ? (inputTokens * price.input +
          cacheRead * price.input * 0.1 +
          outputTokens * price.output) /
        1_000_000 +
        cacheWriteCost
      : 0;

    const record: UsageRecord = {
      id: uuid(),
      sessionId,
      inputTokens,
      outputTokens,
      cacheRead,
      cacheWrite,
      cost,
      model,
      timestamp: new Date().toISOString(),
      pricingUnknown: price === null,
    };

    const db = getDB();
    db.prepare(
      `INSERT INTO usage_records (id, session_id, input_tokens, output_tokens, cache_read, cache_write, cost, model, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      record.id, record.sessionId, record.inputTokens, record.outputTokens,
      record.cacheRead, record.cacheWrite, record.cost, record.model, record.timestamp
    );

    for (const l of this.listeners) l(record);
    return record;
  }

  getSummary(range?: string, sessionId?: string): UsageSummary {
    const db = getDB();
    let filters = '1=1';
    if (range === '7d') filters += " AND timestamp >= datetime('now', '-7 days')";
    else if (range === '30d') filters += " AND timestamp >= datetime('now', '-30 days')";
    if (sessionId) filters += ` AND session_id = '${sessionId}'`;

    const totals = db.prepare(
      `SELECT COALESCE(SUM(cost), 0) as totalCost,
              COALESCE(SUM(input_tokens), 0) as totalInputTokens,
              COALESCE(SUM(output_tokens), 0) as totalOutputTokens,
              COUNT(DISTINCT session_id) as sessionCount
       FROM usage_records WHERE ${filters}`
    ).get() as any;

    const daily = db.prepare(
      `SELECT DATE(timestamp) as date,
              COALESCE(SUM(cost), 0) as cost,
              COALESCE(SUM(input_tokens + output_tokens), 0) as tokens
       FROM usage_records WHERE ${filters}
       GROUP BY DATE(timestamp) ORDER BY date`
    ).all() as any[];

    return {
      totalCost: totals.totalCost,
      totalInputTokens: totals.totalInputTokens,
      totalOutputTokens: totals.totalOutputTokens,
      sessionCount: totals.sessionCount,
      dailyBreakdown: daily.map((d) => ({ date: d.date, cost: d.cost, tokens: d.tokens })),
    };
  }

  getSessionUsage(sessionId: string): UsageRecord[] {
    const db = getDB();
    return db.prepare(
      'SELECT * FROM usage_records WHERE session_id = ? ORDER BY timestamp'
    ).all(sessionId) as any[];
  }

  getDailyUsage(range?: string, sessionId?: string) {
    const db = getDB();
    let filters = '1=1';
    if (range === '7d') filters += " AND timestamp >= datetime('now', '-7 days')";
    else if (range === '30d') filters += " AND timestamp >= datetime('now', '-30 days')";
    if (sessionId) filters += ` AND session_id = '${sessionId}'`;

    return db.prepare(
      `SELECT DATE(timestamp) as date,
              SUM(cost) as cost,
              SUM(input_tokens) as inputTokens,
              SUM(output_tokens) as outputTokens,
              SUM(cache_read) as cacheRead,
              SUM(cache_write) as cacheWrite,
              COUNT(*) as requests
       FROM usage_records WHERE ${filters}
       GROUP BY DATE(timestamp) ORDER BY date`
    ).all();
  }

  getModelUsage(sessionId?: string) {
    const db = getDB();
    const filter = sessionId ? `WHERE session_id = '${sessionId}'` : '';
    return db.prepare(
      `SELECT model, SUM(cost) as cost,
              SUM(input_tokens) as inputTokens,
              SUM(output_tokens) as outputTokens,
              COUNT(*) as requests
       FROM usage_records ${filter} GROUP BY model`
    ).all();
  }

  /** Per-session aggregated summary for all sessions, ordered by cost desc */
  getAllSessionsSummary(range?: string) {
    const db = getDB();
    let dateFilter = '';
    if (range === '7d') dateFilter = "AND ur.timestamp >= datetime('now', '-7 days')";
    else if (range === '30d') dateFilter = "AND ur.timestamp >= datetime('now', '-30 days')";

    return db.prepare(
      `SELECT ur.session_id as sessionId,
              COALESCE(s.name, ur.session_id) as sessionName,
              s.status as sessionStatus,
              s.last_active_at as lastActiveAt,
              COALESCE(SUM(ur.cost), 0) as totalCost,
              COALESCE(SUM(ur.input_tokens), 0) as totalInput,
              COALESCE(SUM(ur.output_tokens), 0) as totalOutput,
              COALESCE(SUM(ur.cache_read), 0) as totalCacheRead,
              COALESCE(SUM(ur.cache_write), 0) as totalCacheWrite,
              COUNT(*) as callCount,
              (SELECT model FROM usage_records WHERE session_id = ur.session_id ORDER BY timestamp DESC LIMIT 1) as model
       FROM usage_records ur
       LEFT JOIN sessions s ON s.id = ur.session_id
       WHERE 1=1 ${dateFilter}
       GROUP BY ur.session_id
       ORDER BY totalCost DESC`
    ).all();
  }

  /** Today's cost total + token counts */
  getTodaySummary() {
    const db = getDB();
    const row = db.prepare(
      `SELECT COALESCE(SUM(cost), 0) as cost,
              COALESCE(SUM(input_tokens), 0) as inputTokens,
              COALESCE(SUM(output_tokens), 0) as outputTokens,
              COUNT(*) as calls
       FROM usage_records WHERE DATE(timestamp) = DATE('now')`
    ).get() as any;
    return {
      cost: row.cost as number,
      inputTokens: row.inputTokens as number,
      outputTokens: row.outputTokens as number,
      calls: row.calls as number,
    };
  }

  /** Aggregated summary for a single session, plus latest input_tokens for context gauge */
  getSessionSummary(sessionId: string) {
    const db = getDB();
    const row = db.prepare(
      `SELECT COALESCE(SUM(cost), 0) as totalCost,
              COALESCE(SUM(input_tokens), 0) as totalInput,
              COALESCE(SUM(output_tokens), 0) as totalOutput,
              COALESCE(SUM(cache_read), 0) as totalCacheRead,
              COALESCE(SUM(cache_write), 0) as totalCacheWrite,
              COUNT(*) as callCount,
              (SELECT input_tokens + cache_read + cache_write FROM usage_records WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1) as latestInput,
              (SELECT model FROM usage_records WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1) as latestModel
       FROM usage_records WHERE session_id = ?`
    ).get(sessionId, sessionId, sessionId) as any;
    const model = (row.latestModel as string) || '';
    return {
      totalCost: row.totalCost as number,
      totalInput: row.totalInput as number,
      totalOutput: row.totalOutput as number,
      totalCacheRead: row.totalCacheRead as number,
      totalCacheWrite: row.totalCacheWrite as number,
      callCount: row.callCount as number,
      latestInputTokens: (row.latestInput as number) || 0,
      model,
      pricingUnknown: model ? getPrice(model) === null : false,
    };
  }
}

export const usageTracker = new UsageTracker();
