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

// OpenAI models — API pricing (used as reference even under subscription)
// Source: https://openai.com/api/pricing
const OPENAI_MODELS: ModelEntry[] = [
  // GPT-5.4 — $2.50 / $15
  { prefix: 'gpt-5.4-mini',  price: { input: 0.75,  output: 4.5  }, context: 272_000 },
  { prefix: 'gpt-5.4-nano',  price: { input: 0.20,  output: 1.25 }, context: 272_000 },
  { prefix: 'gpt-5.4',       price: { input: 2.50,  output: 15   }, context: 272_000 },
  // GPT-5.3
  { prefix: 'gpt-5.3',       price: { input: 2.50,  output: 15   }, context: 272_000 },
  // GPT-5.2 — $1.75 / $14
  { prefix: 'gpt-5.2',       price: { input: 1.75,  output: 14   }, context: 272_000 },
  // GPT-5.1 — $1.25 / $10
  { prefix: 'gpt-5.1-codex-mini', price: { input: 0.25, output: 2 }, context: 272_000 },
  { prefix: 'gpt-5.1',       price: { input: 1.25,  output: 10   }, context: 272_000 },
  // GPT-5 — $1.25 / $10
  { prefix: 'gpt-5-codex-mini', price: { input: 0.25, output: 2  }, context: 272_000 },
  { prefix: 'gpt-5-nano',    price: { input: 0.05,  output: 0.40 }, context: 272_000 },
  { prefix: 'gpt-5-mini',    price: { input: 0.25,  output: 2    }, context: 272_000 },
  { prefix: 'gpt-5',         price: { input: 1.25,  output: 10   }, context: 272_000 },
  // GPT-4.1 — $2 / $8
  { prefix: 'gpt-4.1-nano',  price: { input: 0.10,  output: 0.40 }, context: 272_000 },
  { prefix: 'gpt-4.1-mini',  price: { input: 0.40,  output: 1.60 }, context: 272_000 },
  { prefix: 'gpt-4.1',       price: { input: 2,     output: 8    }, context: 272_000 },
  // Reasoning models
  { prefix: 'o4-mini',       price: { input: 1.10,  output: 4.40 }, context: 272_000 },
  { prefix: 'o3',            price: { input: 2,     output: 8    }, context: 272_000 },
];

const ALL_MODELS = [...MODEL_PRICING, ...OPENAI_MODELS];

function normalizeModel(model: string): string {
  return model.replace(/-\d{8}$/, '');
}

function findEntry(model: string): ModelEntry | undefined {
  const normalized = normalizeModel(model);
  return ALL_MODELS.find(e => normalized.startsWith(e.prefix));
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
