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
        },
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
        glow: '0 0 0 1px rgba(0, 119, 181, 0.2), 0 8px 30px rgba(0, 119, 181, 0.15)',
      },
    },
  },
  plugins: [],
};

export default config;
