/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: {
          DEFAULT: '#070912',
          raised: '#0c0f1c',
          panel: '#0f1322',
        },
        line: {
          DEFAULT: '#1e2540',
          bright: '#2c3560',
        },
        ink: {
          DEFAULT: '#e9e7f2',
          dim: '#9497ad',
          faint: '#565a72',
        },
        accent: '#dfa73f',
        good: '#4fd1a5',
        warn: '#e0824a',
        critical: '#e0524a',
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'ui-monospace', '"Cascadia Code"', '"SF Mono"', 'Consolas', 'monospace'],
        sans: ['"IBM Plex Sans"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
