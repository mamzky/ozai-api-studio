/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: '#0b0e14',
          panel: '#0f131a',
          elevated: '#141922',
          sidebar: '#0a0d12',
          border: '#1e2530',
          strong: '#2a3341',
          text: '#e6edf3',
          muted: '#8b949e',
          faint: '#5b6572',
          accent: '#3b82f6',
          accentSoft: '#1d2b4a'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }]
      },
      boxShadow: {
        panel: '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px rgba(0,0,0,0.35)'
      }
    }
  },
  plugins: []
}
