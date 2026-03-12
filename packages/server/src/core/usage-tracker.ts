import { v4 as uuid } from 'uuid';
import { getDB } from '../db/database.js';
import type { UsageRecord, UsageSummary } from '@ccui/shared';

// Model pricing per million tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-20250514': { input: 15, output: 75 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-haiku-3-5-20241022': { input: 0.8, output: 4 },
};

function getPrice(model: string) {
  for (const [key, price] of Object.entries(MODEL_PRICING)) {
    if (model.includes(key) || key.includes(model)) return price;
  }
  // Default to sonnet pricing
  return { input: 3, output: 15 };
}

type UsageListener = (record: UsageRecord) => void;

class UsageTracker {
  private listeners: UsageListener[] = [];

  onUsage(listener: UsageListener) {
    this.listeners.push(listener);
  }

  recordFromClaude(sessionId: string, usage: any, model: string) {
    const price = getPrice(model);
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheRead = usage.cache_read_input_tokens || 0;
    const cacheWrite = usage.cache_creation_input_tokens || 0;
    const cost =
      (inputTokens * price.input + outputTokens * price.output) / 1_000_000;

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

  getSummary(range?: string): UsageSummary {
    const db = getDB();
    let dateFilter = '';
    if (range === '7d') dateFilter = "AND timestamp >= datetime('now', '-7 days')";
    else if (range === '30d') dateFilter = "AND timestamp >= datetime('now', '-30 days')";

    const totals = db.prepare(
      `SELECT COALESCE(SUM(cost), 0) as totalCost,
              COALESCE(SUM(input_tokens), 0) as totalInputTokens,
              COALESCE(SUM(output_tokens), 0) as totalOutputTokens,
              COUNT(DISTINCT session_id) as sessionCount
       FROM usage_records WHERE 1=1 ${dateFilter}`
    ).get() as any;

    const daily = db.prepare(
      `SELECT DATE(timestamp) as date,
              COALESCE(SUM(cost), 0) as cost,
              COALESCE(SUM(input_tokens + output_tokens), 0) as tokens
       FROM usage_records WHERE 1=1 ${dateFilter}
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

  getDailyUsage(range?: string) {
    const db = getDB();
    let dateFilter = '';
    if (range === '7d') dateFilter = "AND timestamp >= datetime('now', '-7 days')";
    else if (range === '30d') dateFilter = "AND timestamp >= datetime('now', '-30 days')";

    return db.prepare(
      `SELECT DATE(timestamp) as date,
              SUM(cost) as cost,
              SUM(input_tokens) as inputTokens,
              SUM(output_tokens) as outputTokens,
              COUNT(*) as requests
       FROM usage_records WHERE 1=1 ${dateFilter}
       GROUP BY DATE(timestamp) ORDER BY date`
    ).all();
  }

  getModelUsage() {
    const db = getDB();
    return db.prepare(
      `SELECT model, SUM(cost) as cost,
              SUM(input_tokens) as inputTokens,
              SUM(output_tokens) as outputTokens,
              COUNT(*) as requests
       FROM usage_records GROUP BY model`
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
    const totals = db.prepare(
      `SELECT COALESCE(SUM(cost), 0) as totalCost,
              COALESCE(SUM(input_tokens), 0) as totalInput,
              COALESCE(SUM(output_tokens), 0) as totalOutput,
              COUNT(*) as callCount
       FROM usage_records WHERE session_id = ?`
    ).get(sessionId) as any;
    const latest = db.prepare(
      `SELECT input_tokens, model FROM usage_records WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1`
    ).get(sessionId) as any;
    return {
      totalCost: totals.totalCost as number,
      totalInput: totals.totalInput as number,
      totalOutput: totals.totalOutput as number,
      callCount: totals.callCount as number,
      latestInputTokens: (latest?.input_tokens as number) || 0,
      model: (latest?.model as string) || '',
    };
  }
}

export const usageTracker = new UsageTracker();
