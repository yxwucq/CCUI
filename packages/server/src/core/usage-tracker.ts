import { v4 as uuid } from 'uuid';
import { getDB } from '../db/database.js';
import type { UsageRecord, UsageSummary } from '@ccui/shared';

// Model pricing per million tokens (USD), matched by prefix after stripping date suffix
const MODEL_PRICING = [
  { prefix: 'claude-opus-4',     price: { input: 15,  output: 75 } },
  { prefix: 'claude-sonnet-4',   price: { input: 3,   output: 15 } },
  { prefix: 'claude-sonnet-3-5', price: { input: 3,   output: 15 } },
  { prefix: 'claude-haiku-4',    price: { input: 0.8, output: 4  } },
  { prefix: 'claude-haiku-3-5',  price: { input: 0.8, output: 4  } },
];

function getPrice(model: string): { input: number; output: number } | null {
  const normalized = model.replace(/-\d{8}$/, '');
  for (const { prefix, price } of MODEL_PRICING) {
    if (normalized.startsWith(prefix)) return price;
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
    const price = getPrice(model);
    const cost = price
      ? (inputTokens * price.input +
          cacheWrite * price.input * 1.25 +
          cacheRead * price.input * 0.1 +
          outputTokens * price.output) /
        1_000_000
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
