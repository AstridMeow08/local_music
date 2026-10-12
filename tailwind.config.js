/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dafbe1',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#2ea043', // GitHub Primer Green
          600: '#238636', // GitHub button dark green
          700: '#1a7f37',
          800: '#116329',
          900: '#0f5323',
          950: '#07270e',
          glow: '#2ea043',
        },
        ghblue: {
          50: '#eff8ff',
          100: '#ddf4ff',
          200: '#b6e3ff',
          300: '#80ccff',
          400: '#54aeff',
          500: '#0969da', // GitHub Primer Blue (light)
          600: '#0550ae',
          700: '#2f81f7', // GitHub Primer Blue (dark)
          800: '#1f6feb',
          900: '#1158c7',
          950: '#0c2d6b',
        },
        surface: {
          950: 'var(--surface-950)',
          900: 'var(--surface-900)',
          850: 'var(--surface-850)',
          800: 'var(--surface-800)',
          750: 'var(--surface-750)',
          700: 'var(--surface-700)',
          600: 'var(--surface-600)',
          border: 'var(--surface-border)',
          'border-light': 'var(--surface-border-light)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'glow-brand': '0 0 18px -2px rgba(46, 160, 67, 0.45)',
        'glow-blue': '0 0 18px -2px rgba(47, 129, 247, 0.35)',
        'gh-card': '0 1px 3px rgba(31, 35, 40, 0.12), 0 8px 24px rgba(66, 74, 83, 0.12)',
        'glass': '0 1px 3px rgba(31, 35, 40, 0.08), 0 0 0 1px rgba(208, 215, 222, 0.8)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
      }
    },
  },
  plugins: [],
}
