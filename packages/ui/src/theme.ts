/**
 * Unified theme configuration for CCUI.
 * Edit colors here to change both the terminal and UI appearance.
 */

export const theme = {
  // ── Base colors ──
  bg: '#09090b',           // Main background
  bgSurface: '#111114',    // Slightly elevated surfaces (panels, sidebars)
  bgOverlay: '#18181b',    // Overlays, dropdowns, tooltips
  border: '#27272a',       // Default borders
  borderSubtle: '#1e1e22', // Subtle dividers

  // ── Text ──
  text: '#e4e4e7',         // Primary text
  textSecondary: '#a1a1aa',// Secondary text
  textMuted: '#52525b',    // Muted/disabled text

  // ── Accent ──
  accent: '#8b5cf6',       // Primary accent (violet)
  accentHover: '#7c3aed',
  accentMuted: '#7c3aed33',

  // ── Status colors ──
  green: '#4ade80',
  yellow: '#facc15',
  red: '#f87171',
  cyan: '#22d3ee',
  amber: '#fbbf24',
  blue: '#60a5fa',
  emerald: '#34d399',

  // ── Terminal ANSI palette (maps to xterm 0-15) ──
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

/** xterm.js ITheme derived from unified theme */
export const terminalTheme = {
  background: theme.bg,
  foreground: theme.text,
  cursor: 'transparent',
  cursorAccent: 'transparent',
  selectionBackground: theme.accentMuted,
  selectionForeground: theme.ansi.brightWhite,
  ...theme.ansi,
};
