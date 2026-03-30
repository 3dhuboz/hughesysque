/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bbq-red': '#D9381E',
        'bbq-ember': '#ef4444',
        'bbq-dark': '#0f0f0f',
        'bbq-charcoal': '#1f1f1f',
        'bbq-ash': '#2d2d2d',
        'bbq-gold': '#fbbf24',
        'bbq-smoke': '#e5e5e5',
        // Yeppoon Junior Rugby League
        'yjrl-navy': '#0c1d35',
        'yjrl-navy-light': '#1a3a5c',
        'yjrl-gold': '#f0a500',
        'yjrl-gold-light': '#fbbf24',
        'yjrl-red': '#c41e3a',
        'yjrl-cream': '#fef9f0',
        'yjrl-dark': '#060f1c',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Oswald', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'marquee-scroll': 'marqueeScroll 40s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        marqueeScroll: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
}

