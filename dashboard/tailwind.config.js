/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sora', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
      colors: {
        surface: {
          0: '#08090c',
          1: '#0e1117',
          2: '#13161e',
          3: '#191d27',
          4: '#1f2430',
          5: '#262c3a',
        },
        stroke: {
          1: '#1e2332',
          2: '#2a3042',
          3: '#363e52',
        },
        content: {
          1: '#f0f2f8',
          2: '#b0b8cc',
          3: '#6b7590',
          4: '#414b63',
        },
        accent: {
          DEFAULT: '#6366f1',
          light: '#818cf8',
          dark: '#4f46e5',
          muted: 'rgba(99,102,241,0.12)',
          glow: 'rgba(99,102,241,0.25)',
        },
        success: { DEFAULT: '#22c55e', muted: 'rgba(34,197,94,0.12)' },
        warning: { DEFAULT: '#f59e0b', muted: 'rgba(245,158,11,0.12)' },
        danger: { DEFAULT: '#ef4444', muted: 'rgba(239,68,68,0.12)' },
        info: { DEFAULT: '#3b82f6', muted: 'rgba(59,130,246,0.12)' },
      },
      borderRadius: {
        '2xl': '14px',
      },
      animation: {
        'in': 'fadeSlideIn 0.4s ease-out both',
        'in-fast': 'fadeSlideIn 0.25s ease-out both',
        'fade': 'fadeIn 0.35s ease-out both',
        'scale-in': 'scaleIn 0.3s ease-out both',
        'pulse-soft': 'pulseSoft 2.5s ease-in-out infinite',
      },
      keyframes: {
        fadeSlideIn: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        scaleIn: {
          '0%': { opacity: 0, transform: 'scale(0.95)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
      },
    },
  },
  plugins: [],
}
