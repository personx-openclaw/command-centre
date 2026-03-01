import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist Sans', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
      },
      letterSpacing: {
        tight: '-0.025em',
      },
      colors: {
        'bg-base': '#09090B',
        'bg-surface': '#18181B',
        'bg-elevated': '#27272A',
        'text-primary': '#FAFAFA',
        'text-secondary': '#A1A1AA',
        'text-muted': '#52525B',
        'border-subtle': '#27272A',
        'border-default': '#3F3F46',
        'accent-primary': '#6366F1',
        'accent-primary-hover': '#818CF8',
        'accent-primary-muted': 'rgba(99, 102, 241, 0.15)',
        'semantic-success': '#10B981',
        'semantic-warning': '#F59E0B',
        'semantic-error': '#EF4444',
        'semantic-info': '#3B82F6',
        'kanban-backlog': '#52525B',
        'kanban-today': '#6366F1',
        'kanban-in-progress': '#F59E0B',
        'kanban-done': '#10B981',
      },
    },
  },
  plugins: [],
} satisfies Config;
