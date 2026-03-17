/**
 * Extensible theme system for CCUI.
 *
 * To add a new theme, create a ThemeDefinition and register it in `themes`.
 * Only ~15 base values are needed — status color variants are auto-derived.
 */

// ── Color utility functions ──────────────────────────────────────────────

/** Parse hex (#rgb or #rrggbb) to [r, g, b] */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
}

/** Relative luminance (0–1) per WCAG */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isColorDark(hex: string): boolean {
  return luminance(hex) < 0.2;
}

/** Mix a color toward white (amount 0–1) */
function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount,
  );
}

/** Mix a color toward black (amount 0–1) */
function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/** Return hex color with alpha as rgba() string */
function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── Theme definition types ───────────────────────────────────────────────

interface AnsiPalette {
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  base: {
    bg: string;
    bgSurface: string;
    bgOverlay: string;
    border: string;
    borderSubtle: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
  };
  palette: {
    green: string;
    red: string;
    yellow: string;
    blue: string;
    cyan: string;
    purple: string;
    orange: string;
    amber: string;
    emerald: string;
  };
  ansi: AnsiPalette;
  /** Override any derived token */
  overrides?: Partial<DerivedTokens>;
}

/** Full resolved token set — used internally after derivation */
export interface DerivedTokens {
  // Base
  bg: string;
  bgSurface: string;
  bgOverlay: string;
  border: string;
  borderSubtle: string;
  text: string;
  textSecondary: string;
  textMuted: string;

  // Accent
  accent: string;
  accentHover: string;
  accentMuted: string;

  // Status text colors (for labels, icons)
  greenText: string;
  redText: string;
  yellowText: string;
  blueText: string;
  cyanText: string;
  purpleText: string;
  orangeText: string;
  amberText: string;
  emeraldText: string;

  // Status background (subtle tinted bg)
  greenBg: string;
  redBg: string;
  yellowBg: string;
  blueBg: string;
  cyanBg: string;
  purpleBg: string;
  orangeBg: string;
  amberBg: string;
  emeraldBg: string;

  // Status border
  greenBorder: string;
  redBorder: string;
  yellowBorder: string;
  blueBorder: string;
  cyanBorder: string;
  purpleBorder: string;
  orangeBorder: string;
  amberBorder: string;
  emeraldBorder: string;

  // Scrollbar
  scrollbar: string;
  scrollbarHover: string;

  // Glow / animation
  glowAccent: string;
  glowGreen: string;
  glowBlue: string;

  // ANSI
  ansi: AnsiPalette;
}

// ── Derivation engine ────────────────────────────────────────────────────

function deriveTokens(def: ThemeDefinition): DerivedTokens {
  const dark = isColorDark(def.base.bg);
  const p = def.palette;

  const statusText = (color: string) => dark ? lighten(color, 0.25) : darken(color, 0.15);
  const statusBg = (color: string) => dark ? withAlpha(color, 0.12) : withAlpha(color, 0.08);
  const statusBorder = (color: string) => dark ? withAlpha(color, 0.2) : withAlpha(color, 0.2);

  const base: DerivedTokens = {
    ...def.base,

    // Accent derivatives
    accentHover: dark ? darken(def.base.accent, 0.12) : darken(def.base.accent, 0.15),
    accentMuted: withAlpha(def.base.accent, 0.2),

    // Status text
    greenText: statusText(p.green),
    redText: statusText(p.red),
    yellowText: statusText(p.yellow),
    blueText: statusText(p.blue),
    cyanText: statusText(p.cyan),
    purpleText: statusText(p.purple),
    orangeText: statusText(p.orange),
    amberText: statusText(p.amber),
    emeraldText: statusText(p.emerald),

    // Status bg
    greenBg: statusBg(p.green),
    redBg: statusBg(p.red),
    yellowBg: statusBg(p.yellow),
    blueBg: statusBg(p.blue),
    cyanBg: statusBg(p.cyan),
    purpleBg: statusBg(p.purple),
    orangeBg: statusBg(p.orange),
    amberBg: statusBg(p.amber),
    emeraldBg: statusBg(p.emerald),

    // Status border
    greenBorder: statusBorder(p.green),
    redBorder: statusBorder(p.red),
    yellowBorder: statusBorder(p.yellow),
    blueBorder: statusBorder(p.blue),
    cyanBorder: statusBorder(p.cyan),
    purpleBorder: statusBorder(p.purple),
    orangeBorder: statusBorder(p.orange),
    amberBorder: statusBorder(p.amber),
    emeraldBorder: statusBorder(p.emerald),

    // Scrollbar
    scrollbar: dark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
    scrollbarHover: dark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.2)',

    // Glow
    glowAccent: withAlpha(def.base.accent, 0.15),
    glowGreen: withAlpha(p.green, 0.35),
    glowBlue: withAlpha(p.blue, 0.5),

    // ANSI
    ansi: def.ansi,
  };

  return { ...base, ...def.overrides };
}

// ── Theme definitions ────────────────────────────────────────────────────

const darkTheme: ThemeDefinition = {
  id: 'dark',
  name: 'Dark',
  base: {
    bg: '#09090b',
    bgSurface: '#111114',
    bgOverlay: '#18181b',
    border: '#27272a',
    borderSubtle: '#1e1e22',
    text: '#e4e4e7',
    textSecondary: '#a1a1aa',
    textMuted: '#52525b',
    accent: '#8b5cf6',
  },
  palette: {
    green: '#4ade80',
    red: '#f87171',
    yellow: '#facc15',
    blue: '#60a5fa',
    cyan: '#22d3ee',
    purple: '#c084fc',
    orange: '#fb923c',
    amber: '#fbbf24',
    emerald: '#34d399',
  },
  ansi: {
    black: '#18181b',
    red: '#f87171',
    green: '#4ade80',
    yellow: '#facc15',
    blue: '#60a5fa',
    magenta: '#c084fc',
    cyan: '#22d3ee',
    white: '#d4d4d8',
    brightBlack: '#71717a',
    brightRed: '#fca5a5',
    brightGreen: '#86efac',
    brightYellow: '#fde68a',
    brightBlue: '#93c5fd',
    brightMagenta: '#d8b4fe',
    brightCyan: '#67e8f9',
    brightWhite: '#fafafa',
  },
};

const lightTheme: ThemeDefinition = {
  id: 'light',
  name: 'Light',
  base: {
    bg: '#ffffff',
    bgSurface: '#f4f4f5',
    bgOverlay: '#e4e4e7',
    border: '#d4d4d8',
    borderSubtle: '#e4e4e7',
    text: '#18181b',
    textSecondary: '#52525b',
    textMuted: '#a1a1aa',
    accent: '#7c3aed',
  },
  palette: {
    green: '#16a34a',
    red: '#dc2626',
    yellow: '#ca8a04',
    blue: '#2563eb',
    cyan: '#0891b2',
    purple: '#9333ea',
    orange: '#ea580c',
    amber: '#d97706',
    emerald: '#059669',
  },
  ansi: {
    black: '#18181b',
    red: '#dc2626',
    green: '#16a34a',
    yellow: '#ca8a04',
    blue: '#2563eb',
    magenta: '#9333ea',
    cyan: '#0891b2',
    white: '#f4f4f5',
    brightBlack: '#71717a',
    brightRed: '#ef4444',
    brightGreen: '#22c55e',
    brightYellow: '#eab308',
    brightBlue: '#3b82f6',
    brightMagenta: '#a855f7',
    brightCyan: '#06b6d4',
    brightWhite: '#fafafa',
  },
};

const nordTheme: ThemeDefinition = {
  id: 'nord',
  name: 'Nord',
  base: {
    bg: '#2e3440',
    bgSurface: '#3b4252',
    bgOverlay: '#434c5e',
    border: '#4c566a',
    borderSubtle: '#434c5e',
    text: '#eceff4',
    textSecondary: '#d8dee9',
    textMuted: '#7b88a1',
    accent: '#88c0d0',
  },
  palette: {
    green: '#a3be8c',
    red: '#bf616a',
    yellow: '#ebcb8b',
    blue: '#81a1c1',
    cyan: '#88c0d0',
    purple: '#b48ead',
    orange: '#d08770',
    amber: '#ebcb8b',
    emerald: '#a3be8c',
  },
  ansi: {
    black: '#3b4252',
    red: '#bf616a',
    green: '#a3be8c',
    yellow: '#ebcb8b',
    blue: '#81a1c1',
    magenta: '#b48ead',
    cyan: '#88c0d0',
    white: '#e5e9f0',
    brightBlack: '#4c566a',
    brightRed: '#d08770',
    brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b',
    brightBlue: '#81a1c1',
    brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb',
    brightWhite: '#eceff4',
  },
  // blue and cyan are very similar on Nord's blue-gray bg — bump cyan brighter
  overrides: {
    cyanText: '#8fbcbb',  // use Nord frost3 (teal-green) instead of frost2 to separate from blue
  },
};

const draculaTheme: ThemeDefinition = {
  id: 'dracula',
  name: 'Dracula',
  base: {
    bg: '#282a36',
    bgSurface: '#2d2f3d',
    bgOverlay: '#343746',
    border: '#44475a',
    borderSubtle: '#3a3d4e',
    text: '#f8f8f2',
    textSecondary: '#c0c0c0',
    textMuted: '#6272a4',
    accent: '#bd93f9',
  },
  palette: {
    green: '#50fa7b',
    red: '#ff5555',
    yellow: '#f1fa8c',
    blue: '#ff79c6',     // Dracula pink — distinct from cyan for writing vs tool_use
    cyan: '#8be9fd',
    purple: '#bd93f9',
    orange: '#ffb86c',
    amber: '#f1fa8c',
    emerald: '#50fa7b',
  },
  ansi: {
    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff',
  },
};

const catppuccinMochaTheme: ThemeDefinition = {
  id: 'catppuccin',
  name: 'Catppuccin',
  base: {
    bg: '#1e1e2e',
    bgSurface: '#262637',
    bgOverlay: '#313244',
    border: '#45475a',
    borderSubtle: '#383a4e',
    text: '#cdd6f4',
    textSecondary: '#bac2de',
    textMuted: '#6c7086',
    accent: '#cba6f7',
  },
  palette: {
    green: '#a6e3a1',
    red: '#f38ba8',
    yellow: '#f9e2af',
    blue: '#89b4fa',
    cyan: '#94e2d5',
    purple: '#cba6f7',
    orange: '#fab387',
    amber: '#f9e2af',
    emerald: '#a6e3a1',
  },
  ansi: {
    black: '#45475a',
    red: '#f38ba8',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    blue: '#89b4fa',
    magenta: '#f5c2e7',
    cyan: '#94e2d5',
    white: '#bac2de',
    brightBlack: '#585b70',
    brightRed: '#f38ba8',
    brightGreen: '#a6e3a1',
    brightYellow: '#f9e2af',
    brightBlue: '#89b4fa',
    brightMagenta: '#f5c2e7',
    brightCyan: '#94e2d5',
    brightWhite: '#a6adc8',
  },
};

const solarizedDarkTheme: ThemeDefinition = {
  id: 'solarized',
  name: 'Solarized',
  base: {
    bg: '#002b36',
    bgSurface: '#073642',
    bgOverlay: '#0a4050',
    border: '#2a5460',
    borderSubtle: '#1e4652',
    text: '#839496',
    textSecondary: '#93a1a1',
    textMuted: '#586e75',
    accent: '#268bd2',
  },
  palette: {
    green: '#859900',
    red: '#dc322f',
    yellow: '#b58900',
    blue: '#268bd2',
    cyan: '#2aa198',
    purple: '#6c71c4',
    orange: '#cb4b16',
    amber: '#b58900',
    emerald: '#859900',
  },
  ansi: {
    black: '#073642',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5',
    brightBlack: '#586e75',
    brightRed: '#cb4b16',
    brightGreen: '#859900',
    brightYellow: '#b58900',
    brightBlue: '#268bd2',
    brightMagenta: '#6c71c4',
    brightCyan: '#2aa198',
    brightWhite: '#fdf6e3',
  },
  // Solarized bg is teal — cyan blends in, green is too dark, blue = accent
  overrides: {
    cyanText: '#35c9be',     // brighten cyan to stand out on teal bg
    greenText: '#a8b630',    // brighten olive green for idle/done visibility
    blueText: '#549fe8',     // lighten blue to differentiate from accent
  },
};

const tokyoNightTheme: ThemeDefinition = {
  id: 'tokyo-night',
  name: 'Tokyo Night',
  base: {
    bg: '#1a1b26',
    bgSurface: '#1f2335',
    bgOverlay: '#292e42',
    border: '#3b4261',
    borderSubtle: '#2f344d',
    text: '#c0caf5',
    textSecondary: '#a9b1d6',
    textMuted: '#565f89',
    accent: '#7aa2f7',
  },
  palette: {
    green: '#9ece6a',
    red: '#f7768e',
    yellow: '#e0af68',
    blue: '#7aa2f7',
    cyan: '#7dcfff',
    purple: '#bb9af7',
    orange: '#ff9e64',
    amber: '#e0af68',
    emerald: '#73daca',
  },
  ansi: {
    black: '#1f2335',
    red: '#f7768e',
    green: '#9ece6a',
    yellow: '#e0af68',
    blue: '#7aa2f7',
    magenta: '#bb9af7',
    cyan: '#7dcfff',
    white: '#c0caf5',
    brightBlack: '#565f89',
    brightRed: '#f7768e',
    brightGreen: '#9ece6a',
    brightYellow: '#e0af68',
    brightBlue: '#7aa2f7',
    brightMagenta: '#bb9af7',
    brightCyan: '#7dcfff',
    brightWhite: '#c0caf5',
  },
};

// ── Theme registry ───────────────────────────────────────────────────────

export const themes: Record<string, ThemeDefinition> = {
  dark: darkTheme,
  light: lightTheme,
  nord: nordTheme,
  dracula: draculaTheme,
  catppuccin: catppuccinMochaTheme,
  solarized: solarizedDarkTheme,
  'tokyo-night': tokyoNightTheme,
};

// ── Runtime state ────────────────────────────────────────────────────────

let currentTokens: DerivedTokens = deriveTokens(darkTheme);
let currentThemeId = 'dark';

export function getCurrentThemeId(): string {
  return currentThemeId;
}

export function getTokens(): DerivedTokens {
  return currentTokens;
}

/** Build xterm.js ITheme from current tokens */
export function getTerminalTheme() {
  const t = currentTokens;
  return {
    background: t.bg,
    foreground: t.text,
    cursor: 'transparent',
    cursorAccent: 'transparent',
    selectionBackground: t.accentMuted,
    selectionForeground: t.ansi.brightWhite,
    scrollbarSliderBackground: t.scrollbar,
    scrollbarSliderHoverBackground: t.scrollbarHover,
    scrollbarSliderActiveBackground: t.scrollbarHover,
    ...t.ansi,
  };
}

// ── Listeners for theme changes ──────────────────────────────────────────

type ThemeChangeListener = (themeId: string, tokens: DerivedTokens) => void;
const listeners = new Set<ThemeChangeListener>();

export function onThemeChange(fn: ThemeChangeListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── Apply theme ──────────────────────────────────────────────────────────

export function applyTheme(themeId: string) {
  const def = themes[themeId] ?? themes.dark;
  currentThemeId = def.id;
  currentTokens = deriveTokens(def);
  const t = currentTokens;

  document.documentElement.classList.add('theme-transitioning');
  const s = document.documentElement.style;

  // Base
  s.setProperty('--cc-bg', t.bg);
  s.setProperty('--cc-bg-surface', t.bgSurface);
  s.setProperty('--cc-bg-overlay', t.bgOverlay);
  s.setProperty('--cc-border', t.border);
  s.setProperty('--cc-border-subtle', t.borderSubtle);
  s.setProperty('--cc-text', t.text);
  s.setProperty('--cc-text-secondary', t.textSecondary);
  s.setProperty('--cc-text-muted', t.textMuted);

  // Accent
  s.setProperty('--cc-accent', t.accent);
  s.setProperty('--cc-accent-hover', t.accentHover);
  s.setProperty('--cc-accent-muted', t.accentMuted);

  // Status text
  s.setProperty('--cc-green-text', t.greenText);
  s.setProperty('--cc-red-text', t.redText);
  s.setProperty('--cc-yellow-text', t.yellowText);
  s.setProperty('--cc-blue-text', t.blueText);
  s.setProperty('--cc-cyan-text', t.cyanText);
  s.setProperty('--cc-purple-text', t.purpleText);
  s.setProperty('--cc-orange-text', t.orangeText);
  s.setProperty('--cc-amber-text', t.amberText);
  s.setProperty('--cc-emerald-text', t.emeraldText);

  // Status bg
  s.setProperty('--cc-green-bg', t.greenBg);
  s.setProperty('--cc-red-bg', t.redBg);
  s.setProperty('--cc-yellow-bg', t.yellowBg);
  s.setProperty('--cc-blue-bg', t.blueBg);
  s.setProperty('--cc-cyan-bg', t.cyanBg);
  s.setProperty('--cc-purple-bg', t.purpleBg);
  s.setProperty('--cc-orange-bg', t.orangeBg);
  s.setProperty('--cc-amber-bg', t.amberBg);
  s.setProperty('--cc-emerald-bg', t.emeraldBg);

  // Status border
  s.setProperty('--cc-green-border', t.greenBorder);
  s.setProperty('--cc-red-border', t.redBorder);
  s.setProperty('--cc-yellow-border', t.yellowBorder);
  s.setProperty('--cc-blue-border', t.blueBorder);
  s.setProperty('--cc-cyan-border', t.cyanBorder);
  s.setProperty('--cc-purple-border', t.purpleBorder);
  s.setProperty('--cc-orange-border', t.orangeBorder);
  s.setProperty('--cc-amber-border', t.amberBorder);
  s.setProperty('--cc-emerald-border', t.emeraldBorder);

  // Scrollbar
  s.setProperty('--cc-scrollbar', t.scrollbar);
  s.setProperty('--cc-scrollbar-hover', t.scrollbarHover);

  // Glow / animation
  s.setProperty('--cc-glow-accent', t.glowAccent);
  s.setProperty('--cc-glow-green', t.glowGreen);
  s.setProperty('--cc-glow-blue', t.glowBlue);

  // Notify listeners
  listeners.forEach((fn) => fn(currentThemeId, currentTokens));

  setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 400);
}

// ── Backward compatibility ───────────────────────────────────────────────

/** @deprecated Use applyTheme() instead */
export const injectThemeVars = () => applyTheme(currentThemeId);

/** @deprecated Use getTokens() instead */
export const theme = {
  get bg() { return currentTokens.bg; },
  get bgSurface() { return currentTokens.bgSurface; },
  get bgOverlay() { return currentTokens.bgOverlay; },
  get border() { return currentTokens.border; },
  get borderSubtle() { return currentTokens.borderSubtle; },
  get text() { return currentTokens.text; },
  get textSecondary() { return currentTokens.textSecondary; },
  get textMuted() { return currentTokens.textMuted; },
  get accent() { return currentTokens.accent; },
  get accentHover() { return currentTokens.accentHover; },
  get accentMuted() { return currentTokens.accentMuted; },
  get green() { return currentTokens.greenText; },
  get yellow() { return currentTokens.yellowText; },
  get red() { return currentTokens.redText; },
  get cyan() { return currentTokens.cyanText; },
  get amber() { return currentTokens.amberText; },
  get blue() { return currentTokens.blueText; },
  get emerald() { return currentTokens.emeraldText; },
  get ansi() { return currentTokens.ansi; },
};

/** @deprecated Use getTerminalTheme() instead */
export const terminalTheme = new Proxy({} as any, {
  get(_target, prop) {
    return (getTerminalTheme() as any)[prop];
  },
});
