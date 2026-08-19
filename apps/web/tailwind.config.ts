import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // A deliberately calm palette — the outline asks for a "calmed landing",
        // not a dashboard that screams for attention.
        calm: {
          bg: '#0f1115',
          surface: '#171a21',
          border: '#262b36',
          text: '#e6e8ec',
          muted: '#8b93a3',
          accent: '#7dd3c0',
        },
      },
    },
  },
  plugins: [],
};

export default config;
