import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:            '#FFFFFF',
        surface:       '#FFFFFF',
        'surface-2':   '#F4F4F5',
        border:        '#E4E4E7',
        text:          '#18181B',
        muted:         '#71717A',
        accent:        '#E86C3A',
        'accent-light':'#FFF1EB',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:      '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-md': '0 4px 12px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04)',
        'card-lg': '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
      },
      animation: {
        blink:    'blink 1s step-end infinite',
        'fade-up':'fadeUp 0.35s ease forwards',
        'slide-in':'slideIn 0.3s ease forwards',
      },
      keyframes: {
        blink:   { '0%,100%': { opacity: '1' }, '50%': { opacity: '0' } },
        fadeUp:  { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideIn: { from: { opacity: '0', transform: 'translateX(-10px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
} satisfies Config
