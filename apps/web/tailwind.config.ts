import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Immersive but calm — depth without dashboard noise or gamification chrome.
        calm: {
          bg: '#0b0d12',
          surface: '#12151c',
          'surface-elevated': '#181c26',
          border: '#2a3140',
          'border-soft': '#1e2430',
          text: '#e8eaef',
          muted: '#8b93a3',
          accent: '#6ec8b8',
          'accent-soft': '#6ec8b833',
          astra: '#5eb0e0',
          kaelen: '#e0a85e',
          synthetix: '#5ecb9a',
          veritas: '#a78bfa',
        },
      },
      boxShadow: {
        panel: '0 0 0 1px rgba(42, 49, 64, 0.6), 0 12px 40px rgba(0, 0, 0, 0.35)',
        glow: '0 0 24px rgba(110, 200, 184, 0.08)',
      },
      backgroundImage: {
        'ambient-radial':
          'radial-gradient(1200px 600px at 20% -10%, rgba(110, 200, 184, 0.07), transparent 55%), radial-gradient(900px 500px at 90% 10%, rgba(94, 176, 224, 0.05), transparent 50%)',
      },
    },
  },
  plugins: [],
};

export default config;
