/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cc: {
          bg:             'var(--cc-bg)',
          'bg-surface':   'var(--cc-bg-surface)',
          'bg-overlay':   'var(--cc-bg-overlay)',
          border:         'var(--cc-border)',
          'border-subtle':'var(--cc-border-subtle)',
          text:           'var(--cc-text)',
          'text-secondary':'var(--cc-text-secondary)',
          'text-muted':   'var(--cc-text-muted)',
          accent:         'var(--cc-accent)',
          'accent-hover': 'var(--cc-accent-hover)',
          'accent-muted': 'var(--cc-accent-muted)',

          // Status text
          'green-text':   'var(--cc-green-text)',
          'red-text':     'var(--cc-red-text)',
          'yellow-text':  'var(--cc-yellow-text)',
          'blue-text':    'var(--cc-blue-text)',
          'cyan-text':    'var(--cc-cyan-text)',
          'purple-text':  'var(--cc-purple-text)',
          'orange-text':  'var(--cc-orange-text)',
          'amber-text':   'var(--cc-amber-text)',
          'emerald-text': 'var(--cc-emerald-text)',

          // Status backgrounds
          'green-bg':     'var(--cc-green-bg)',
          'red-bg':       'var(--cc-red-bg)',
          'yellow-bg':    'var(--cc-yellow-bg)',
          'blue-bg':      'var(--cc-blue-bg)',
          'cyan-bg':      'var(--cc-cyan-bg)',
          'purple-bg':    'var(--cc-purple-bg)',
          'orange-bg':    'var(--cc-orange-bg)',
          'amber-bg':     'var(--cc-amber-bg)',
          'emerald-bg':   'var(--cc-emerald-bg)',

          // Status borders
          'green-border': 'var(--cc-green-border)',
          'red-border':   'var(--cc-red-border)',
          'yellow-border':'var(--cc-yellow-border)',
          'blue-border':  'var(--cc-blue-border)',
          'cyan-border':  'var(--cc-cyan-border)',
          'purple-border':'var(--cc-purple-border)',
          'orange-border':'var(--cc-orange-border)',
          'amber-border': 'var(--cc-amber-border)',
          'emerald-border':'var(--cc-emerald-border)',
        },
      },
    },
  },
  plugins: [],
};
