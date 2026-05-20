import type { Config } from 'tailwindcss';

// Brand foundation — deck slides 02 (color tokens) + 03 (typography).
// Mirrored from apps/runtime/src/ui/colors.ts so terminal UI and web layer
// share one design system.
const config: Config = {
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0E0E0E',
        ash: '#1A1816',
        smoke: '#2A2826',
        cream: '#EDE6D6',
        ember: '#E0633A',
        teal: '#5FA8A0',
        amber: '#E8C56B',
        dim: '#7A7268',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      letterSpacing: {
        tightish: '-0.01em',
        widish: '0.06em',
      },
    },
  },
  plugins: [],
};

export default config;
