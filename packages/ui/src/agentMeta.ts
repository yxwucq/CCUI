// Visual metadata for agents: emoji + accent color, keyed by agent name.
// Falls back to a hash-based color for custom agents.

type AgentMeta = { emoji: string; color: string; bg: string; border: string };

const KNOWN: Record<string, AgentMeta> = {
  'Code Reviewer':         { emoji: '🔍', color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30' },
  'Bug Fixer':             { emoji: '🐛', color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/30' },
  'Docs Writer':           { emoji: '📝', color: 'text-green-400',   bg: 'bg-green-500/10',   border: 'border-green-500/30' },
  'Refactorer':            { emoji: '♻️',  color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/30' },
  'Security Auditor':      { emoji: '🔒', color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30' },
  'Test Writer':           { emoji: '✅', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  'Architect':             { emoji: '🏗️', color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30' },
  'Performance Optimizer': { emoji: '⚡', color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/30' },
  'Git Commit Reviewer':   { emoji: '📦', color: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-slate-500/30' },
  'Rubber Duck':           { emoji: '🦆', color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30' },
  'Legacy Modernizer':     { emoji: '🔄', color: 'text-teal-400',    bg: 'bg-teal-500/10',    border: 'border-teal-500/30' },
  'TDD Coach':             { emoji: '🔴', color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30' },
  'Explainer':             { emoji: '💡', color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/30' },
};

const FALLBACK_COLORS: AgentMeta[] = [
  { emoji: '🤖', color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/30' },
  { emoji: '🤖', color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30' },
  { emoji: '🤖', color: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/30' },
  { emoji: '🤖', color: 'text-lime-400',    bg: 'bg-lime-500/10',    border: 'border-lime-500/30' },
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

export function getAgentMeta(name: string): AgentMeta {
  return KNOWN[name] ?? FALLBACK_COLORS[hashName(name) % FALLBACK_COLORS.length];
}
