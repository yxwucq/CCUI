import { useState } from 'react';
import { themes, applyTheme, getCurrentThemeId, type ThemeDefinition } from '../theme';

const PALETTE_KEYS = ['green', 'red', 'yellow', 'blue', 'cyan', 'purple', 'orange', 'amber'] as const;
const BASE_KEYS = ['bg', 'bgSurface', 'bgOverlay', 'border', 'borderSubtle', 'text', 'textSecondary', 'textMuted', 'accent'] as const;

type PaletteKey = typeof PALETTE_KEYS[number];

/** Find pairs of colors that are very close (deltaE < threshold) */
function hexDistance(a: string, b: string): number {
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function Swatch({ color, label, size = 'md' }: { color: string; label?: string; size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'lg' ? 'w-16 h-16' : size === 'md' ? 'w-10 h-10' : 'w-7 h-7';
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`${dims} rounded-md border border-white/10 shadow-sm`}
        style={{ backgroundColor: color }}
        title={`${label ?? ''} ${color}`}
      />
      {label && <span className="text-[10px] text-cc-text-muted leading-tight text-center">{label}</span>}
      <span className="text-[9px] font-mono text-cc-text-muted/60">{color}</span>
    </div>
  );
}

function SimilarityWarnings({ def }: { def: ThemeDefinition }) {
  const warnings: { a: string; b: string; dist: number }[] = [];
  for (let i = 0; i < PALETTE_KEYS.length; i++) {
    for (let j = i + 1; j < PALETTE_KEYS.length; j++) {
      const ka = PALETTE_KEYS[i];
      const kb = PALETTE_KEYS[j];
      const ca = def.palette[ka];
      const cb = def.palette[kb];
      const dist = hexDistance(ca, cb);
      if (dist < 40) {
        warnings.push({ a: ka, b: kb, dist });
      }
    }
  }
  if (warnings.length === 0) return <span className="text-xs text-cc-green-text">No conflicts</span>;
  return (
    <div className="flex flex-col gap-1">
      {warnings.map(({ a, b, dist }) => (
        <div key={`${a}-${b}`} className="flex items-center gap-2 text-xs">
          <span className={`font-medium ${dist === 0 ? 'text-cc-red-text' : 'text-cc-yellow-text'}`}>
            {dist === 0 ? 'IDENTICAL' : `dist=${dist.toFixed(0)}`}
          </span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm border border-white/10" style={{ backgroundColor: def.palette[a as PaletteKey] }} />
            <span className="text-cc-text-secondary">{a}</span>
          </div>
          <span className="text-cc-text-muted">vs</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm border border-white/10" style={{ backgroundColor: def.palette[b as PaletteKey] }} />
            <span className="text-cc-text-secondary">{b}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ThemeCard({ def, isActive, onApply }: { def: ThemeDefinition; isActive: boolean; onApply: () => void }) {
  return (
    <div className={`rounded-lg border p-4 transition-colors ${isActive ? 'border-cc-accent bg-cc-accent-muted' : 'border-cc-border bg-cc-bg-surface'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-cc-text">{def.name} <span className="text-cc-text-muted font-mono text-xs">({def.id})</span></h3>
        <button onClick={onApply} className={`text-xs px-2 py-0.5 rounded ${isActive ? 'bg-cc-accent text-white' : 'bg-cc-bg-overlay text-cc-text-secondary hover:bg-cc-accent hover:text-white'} transition-colors`}>
          {isActive ? 'Active' : 'Apply'}
        </button>
      </div>

      {/* Base colors */}
      <div className="mb-3">
        <span className="text-[10px] uppercase tracking-wider text-cc-text-muted mb-1.5 block">Base</span>
        <div className="flex gap-2 flex-wrap">
          {BASE_KEYS.map((k) => (
            <Swatch key={k} color={def.base[k]} label={k} size="sm" />
          ))}
        </div>
      </div>

      {/* Palette colors */}
      <div className="mb-3">
        <span className="text-[10px] uppercase tracking-wider text-cc-text-muted mb-1.5 block">Palette</span>
        <div className="flex gap-2 flex-wrap">
          {PALETTE_KEYS.map((k) => (
            <Swatch key={k} color={def.palette[k]} label={k} />
          ))}
        </div>
      </div>

      {/* Simulated status bar — how statuses look on this theme's bg */}
      <div className="mb-3">
        <span className="text-[10px] uppercase tracking-wider text-cc-text-muted mb-1.5 block">Status simulation (on theme bg)</span>
        <div className="flex gap-1 flex-wrap rounded-md p-2 border border-white/5" style={{ backgroundColor: def.base.bg }}>
          {(['green', 'amber', 'cyan', 'blue', 'orange', 'red', 'yellow', 'purple'] as PaletteKey[]).map((k) => {
            const statusLabels: Record<string, string> = {
              green: 'idle/done', amber: 'thinking', cyan: 'running', blue: 'writing',
              orange: 'waiting', red: 'error', yellow: 'warning', purple: 'badge',
            };
            return (
              <span
                key={k}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  color: def.palette[k],
                  backgroundColor: def.palette[k] + '18',
                  border: `1px solid ${def.palette[k]}33`,
                }}
              >
                {statusLabels[k] ?? k}
              </span>
            );
          })}
        </div>
      </div>

      {/* ANSI palette */}
      <div className="mb-3">
        <span className="text-[10px] uppercase tracking-wider text-cc-text-muted mb-1.5 block">ANSI (16 colors)</span>
        <div className="flex gap-0.5">
          {(['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'] as const).map((k) => (
            <div key={k} className="w-6 h-4 rounded-sm border border-white/5" style={{ backgroundColor: def.ansi[k] }} title={`${k}: ${def.ansi[k]}`} />
          ))}
        </div>
        <div className="flex gap-0.5 mt-0.5">
          {(['brightBlack', 'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite'] as const).map((k) => (
            <div key={k} className="w-6 h-4 rounded-sm border border-white/5" style={{ backgroundColor: def.ansi[k] }} title={`${k}: ${def.ansi[k]}`} />
          ))}
        </div>
      </div>

      {/* Similarity warnings */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-cc-text-muted mb-1 block">Color conflicts</span>
        <SimilarityWarnings def={def} />
      </div>

      {/* Overrides */}
      {def.overrides && Object.keys(def.overrides).length > 0 && (
        <div className="mt-2">
          <span className="text-[10px] uppercase tracking-wider text-cc-text-muted mb-1 block">Overrides</span>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(def.overrides).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1 text-[10px]">
                <div className="w-3 h-3 rounded-sm border border-white/10" style={{ backgroundColor: v as string }} />
                <span className="text-cc-text-secondary">{k}</span>
                <span className="font-mono text-cc-text-muted">{v as string}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Cross-theme comparison: show one color across all themes side by side */
function CrossThemeComparison() {
  const themeList = Object.values(themes);
  const [selectedPair, setSelectedPair] = useState<[PaletteKey, PaletteKey]>(['amber', 'yellow']);

  const confusingPairs: [PaletteKey, PaletteKey, string][] = [
    ['amber', 'yellow', 'thinking vs warning — identical in 5/7 themes'],
    ['blue', 'cyan', 'writing vs running — hard to distinguish in Nord/Solarized'],
    ['orange', 'amber', 'waiting vs thinking — both warm tones'],
    ['orange', 'yellow', 'waiting vs warning'],
  ];

  return (
    <div className="rounded-lg border border-cc-border bg-cc-bg-surface p-4">
      <h3 className="text-sm font-semibold text-cc-text mb-3">Cross-Theme Pair Comparison</h3>
      <div className="flex gap-2 mb-4 flex-wrap">
        {confusingPairs.map(([a, b, desc]) => (
          <button
            key={`${a}-${b}`}
            onClick={() => setSelectedPair([a, b])}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              selectedPair[0] === a && selectedPair[1] === b
                ? 'bg-cc-accent text-white'
                : 'bg-cc-bg-overlay text-cc-text-secondary hover:bg-cc-bg-overlay/80'
            }`}
            title={desc}
          >
            {a} vs {b}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-3">
        {themeList.map((def) => {
          const colorA = def.palette[selectedPair[0]];
          const colorB = def.palette[selectedPair[1]];
          const dist = hexDistance(colorA, colorB);
          const identical = dist === 0;
          return (
            <div key={def.id} className="flex flex-col items-center gap-2">
              <span className="text-[10px] text-cc-text-muted font-medium">{def.name}</span>
              <div className="rounded-md border border-white/5 p-2 flex flex-col items-center gap-1" style={{ backgroundColor: def.base.bg }}>
                <div className="flex gap-1">
                  <div className="w-8 h-8 rounded" style={{ backgroundColor: colorA }} title={`${selectedPair[0]}: ${colorA}`} />
                  <div className="w-8 h-8 rounded" style={{ backgroundColor: colorB }} title={`${selectedPair[1]}: ${colorB}`} />
                </div>
                {/* Show as status pills on theme bg */}
                <div className="flex gap-0.5 mt-1">
                  <span className="text-[8px] font-medium px-1.5 py-0.5 rounded-full" style={{ color: colorA, backgroundColor: colorA + '20' }}>
                    {selectedPair[0]}
                  </span>
                  <span className="text-[8px] font-medium px-1.5 py-0.5 rounded-full" style={{ color: colorB, backgroundColor: colorB + '20' }}>
                    {selectedPair[1]}
                  </span>
                </div>
              </div>
              <span className={`text-[9px] font-mono ${identical ? 'text-cc-red-text font-bold' : dist < 40 ? 'text-cc-yellow-text' : 'text-cc-green-text'}`}>
                {identical ? 'SAME' : `d=${dist.toFixed(0)}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ThemePreview() {
  const [activeTheme, setActiveTheme] = useState(getCurrentThemeId());
  const themeList = Object.values(themes);

  const handleApply = (id: string) => {
    applyTheme(id);
    setActiveTheme(id);
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-cc-text">Theme Color Preview</h1>
        <p className="text-sm text-cc-text-secondary mt-1">
          All {themeList.length} themes with palette swatches, status simulation, and conflict detection.
        </p>
      </div>

      {/* Cross-theme comparison */}
      <CrossThemeComparison />

      {/* Per-theme cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {themeList.map((def) => (
          <ThemeCard
            key={def.id}
            def={def}
            isActive={def.id === activeTheme}
            onApply={() => handleApply(def.id)}
          />
        ))}
      </div>
    </div>
  );
}
