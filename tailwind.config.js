/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette keys are still named `god` so the ~40 components keep working, but the
        // values are the bid.tg look: near-black terminal ground, WHITE primary elements,
        // cyan neon accents. Swap these values to re-theme the whole app in one place.
        god: {
          bg: '#05060a',
          surface: '#0a0c12',
          card: '#0d1017',
          elevated: '#12151d',
          border: 'rgba(255, 255, 255, 0.10)',
          borderStrong: 'rgba(95, 251, 241, 0.42)',
          // "gold" is now the primary WHITE (kept the key name to avoid touching components)
          gold: '#eef2f5',
          goldLight: '#ffffff',
          goldDeep: '#5ffbf1', // the cyan neon accent
          cream: '#e6ebf0',
          muted: 'rgba(230, 235, 240, 0.55)',
          faint: 'rgba(230, 235, 240, 0.30)',
          success: '#39ff14',
          danger: '#ff3860',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        // headings/logo lean into the terminal look
        display: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        arcade: ['"VT323"', '"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        // crisper, more terminal-panel corners
        xl: '0.5rem',
        '2xl': '0.7rem',
        '3xl': '1rem',
      },
      boxShadow: {
        // "gold" shadow key kept, now a cyan neon glow
        gold: '0 0 22px rgba(95, 251, 241, 0.40)',
        goldSoft: '0 0 40px rgba(95, 251, 241, 0.20)',
        card: '0 10px 40px -12px rgba(0, 0, 0, 0.85)',
        inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      },
      backgroundImage: {
        // primary "button" fill: bright white with a faint cyan edge
        'gold-gradient': 'linear-gradient(135deg, #ffffff 0%, #dcfbf8 55%, #a9f2ec 100%)',
        'gold-radial': 'radial-gradient(circle at 50% 0%, rgba(95,251,241,0.14), transparent 70%)',
        'card-gradient': 'linear-gradient(160deg, rgba(95,251,241,0.05), rgba(13,16,23,0.25))',
        // faint CRT scanline overlay
        scanlines:
          'repeating-linear-gradient(to bottom, rgba(255,255,255,0.028) 0px, rgba(255,255,255,0.028) 1px, transparent 1px, transparent 3px)',
      },
      keyframes: {
        glow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(95, 251, 241, 0.35)' },
          '50%': { boxShadow: '0 0 26px rgba(95, 251, 241, 0.65)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        glow: 'glow 2s ease-in-out infinite',
        'fade-up': 'fade-up 0.4s ease-out both',
        'scale-in': 'scale-in 0.2s ease-out both',
        shimmer: 'shimmer 1.8s linear infinite',
        'slide-up': 'slide-up 0.32s cubic-bezier(0.22, 1, 0.36, 1) both',
        blink: 'blink 1.1s step-end infinite',
      },
    },
  },
  plugins: [],
};
