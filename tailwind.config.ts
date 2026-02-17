import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
          panel: 'var(--bg-panel)',
        },
        primary: '#f3f4f6',
        'primary-25': '#f8fafc',
        primary_hover: '#e7ebf1',
        primary_alt: '#eef2ff',
        'primary-solid': '#3b82f6',
        secondary: '#374151',
        secondary_alt: '#eef2f7',
        secondary_hover: '#111827',
        active: '#121417',
        overlay: '#0f172a',
        brand: {
          primary_alt: 'rgba(59, 130, 246, 0.15)',
          secondary: '#2563eb',
          secondary_hover: '#1d4ed8',
          tertiary: '#dbeafe',
          solid: '#3b82f6',
          solid_hover: '#2563eb',
        },
        fg: {
          secondary: '#334155',
          secondary_hover: '#111827',
          quaternary: '#6b7280',
          quaternary_hover: '#111827',
          white: '#ffffff',
          disabled: '#94a3b8',
          disabled_subtle: '#cbd5e1',
          error: {
            primary: '#fda4af',
            secondary: '#fecdd3',
          },
          brand: {
            primary_alt: '#3b82f6',
            secondary_alt: '#2563eb',
            secondary_hover: '#1d4ed8',
          },
        },
        'border-secondary': '#e5e7eb',
        'focus-ring': '#60a5fa',
        border: 'var(--border)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        success: 'var(--success)',
        error: 'var(--error)',
        warning: 'var(--warning)',
        text: {
          primary: 'var(--text-primary)',
          muted: 'var(--text-muted)',
          faint: 'var(--text-faint)',
        },
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(2, 8, 20, 0.35)',
        glow: '0 0 0 1px rgba(17, 176, 233, 0.28), 0 16px 40px rgba(17, 176, 233, 0.25)',
      },
      fontSize: {
        md: ['0.875rem', { lineHeight: '1.25rem' }],
      },
    },
  },
  plugins: [],
};

export default config;
