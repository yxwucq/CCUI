// Claude model pricing and context window data.
// Source: https://platform.claude.com/docs/en/about-claude/pricing
//         https://platform.claude.com/docs/en/docs/about-claude/models
//
// Matched by prefix after stripping trailing date suffix (e.g. -20251101).
// Order matters: more specific prefixes must come before shorter ones.

interface ModelEntry {
  prefix: string;
  price: { input: number; output: number };
  context: number;
}

const MODEL_PRICING: ModelEntry[] = [
  // Opus 4.6 — $5 / $25, 1M context
  { prefix: 'claude-opus-4-6',   price: { input: 5,    output: 25   }, context: 1_000_000 },
  // Opus 4.5 — $5 / $25, 200k context
  { prefix: 'claude-opus-4-5',   price: { input: 5,    output: 25   }, context: 200_000 },
  // Opus 4.1 — $15 / $75, 200k context
  { prefix: 'claude-opus-4-1',   price: { input: 15,   output: 75   }, context: 200_000 },
  // Opus 4.0 fallback — $15 / $75, 200k context
  { prefix: 'claude-opus-4',     price: { input: 15,   output: 75   }, context: 200_000 },
  // Sonnet 4.6 — $3 / $15, 1M context
  { prefix: 'claude-sonnet-4-6', price: { input: 3,    output: 15   }, context: 1_000_000 },
  // Sonnet 4.5 — $3 / $15, 200k context (1M with beta header)
  { prefix: 'claude-sonnet-4-5', price: { input: 3,    output: 15   }, context: 200_000 },
  // Sonnet 4.x fallback — $3 / $15, 200k context
  { prefix: 'claude-sonnet-4',   price: { input: 3,    output: 15   }, context: 200_000 },
  // Claude 3.7 Sonnet (deprecated) — $3 / $15
  { prefix: 'claude-3-7-sonnet', price: { input: 3,    output: 15   }, context: 200_000 },
  // Claude 3.5 Sonnet — $3 / $15
  { prefix: 'claude-3-5-sonnet', price: { input: 3,    output: 15   }, context: 200_000 },
  // Haiku 4.5 — $1 / $5, 200k context
  { prefix: 'claude-haiku-4-5',  price: { input: 1,    output: 5    }, context: 200_000 },
  // Haiku 4.x fallback — $1 / $5
  { prefix: 'claude-haiku-4',    price: { input: 1,    output: 5    }, context: 200_000 },
  // Claude 3.5 Haiku — $0.8 / $4
  { prefix: 'claude-3-5-haiku',  price: { input: 0.8,  output: 4    }, context: 200_000 },
  // Claude 3 Opus (deprecated) — $15 / $75
  { prefix: 'claude-3-opus',     price: { input: 15,   output: 75   }, context: 200_000 },
  // Claude 3 Haiku (deprecated) — $0.25 / $1.25
  { prefix: 'claude-3-haiku',    price: { input: 0.25, output: 1.25 }, context: 200_000 },
];

function normalizeModel(model: string): string {
  return model.replace(/-\d{8}$/, '');
}

function findEntry(model: string): ModelEntry | undefined {
  const normalized = normalizeModel(model);
  return MODEL_PRICING.find(e => normalized.startsWith(e.prefix));
}

export function getPrice(model: string): { input: number; output: number } | null {
  return findEntry(model)?.price ?? null;
}

export function getContextWindow(model: string): number {
  return findEntry(model)?.context ?? 200_000;
}

// Cache pricing multipliers (relative to base input price):
//   5-minute cache write: 1.25x
//   1-hour cache write:   2.0x
//   Cache read (hit):     0.1x
export const CACHE_MULTIPLIERS = {
  write5m: 1.25,
  write1h: 1.25,
  read: 0.1,
} as const;
