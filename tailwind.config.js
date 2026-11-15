/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#07090E',
          surface: '#0E141F',
          surfaceElevated: '#131B29',
          border: '#1E293B',
          cyan: '#00F0FF',
          emerald: '#10B981',
          crimson: '#EF4444',
          amber: '#F59E0B',
          violet: '#8B5CF6',
          text: '#F1F5F9',
          muted: '#94A3B8',
        },
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-8px)' },
          '30%': { transform: 'translateX(8px)' },
          '45%': { transform: 'translateX(-6px)' },
          '60%': { transform: 'translateX(6px)' },
          '75%': { transform: 'translateX(-3px)' },
          '90%': { transform: 'translateX(3px)' },
        },
        flashGreen: {
          '0%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.7), inset 0 0 40px rgba(16, 185, 129, 0.25)' },
          '50%': { boxShadow: '0 0 36px 4px rgba(16, 185, 129, 0.45), inset 0 0 56px rgba(16, 185, 129, 0.18)' },
          '100%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0), inset 0 0 0 rgba(16, 185, 129, 0)' },
        },
        flashRed: {
          '0%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.7), inset 0 0 40px rgba(239, 68, 68, 0.28)' },
          '50%': { boxShadow: '0 0 32px 4px rgba(239, 68, 68, 0.4), inset 0 0 56px rgba(239, 68, 68, 0.2)' },
          '100%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0), inset 0 0 0 rgba(239, 68, 68, 0)' },
        },
        slideToast: {
          '0%': { opacity: '0', transform: 'translateY(-10px) scale(0.96)' },
          '12%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '88%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(-6px) scale(0.98)' },
        },
      },
      animation: {
        shake: 'shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) both',
        flashGreen: 'flashGreen 0.75s ease-out',
        flashRed: 'flashRed 0.65s ease-out',
        slideToast: 'slideToast 2.4s ease-out forwards',
      },
    },
  },
  plugins: [],
};
