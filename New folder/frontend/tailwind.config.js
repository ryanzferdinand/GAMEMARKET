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
        // Apple Design System — Action Blue
        accent: {
          DEFAULT: '#0066cc',
          focus:   '#0071e3',
          dark:    '#2997ff',
          50:      '#e8f0fa',
          100:     '#c5d9f5',
          200:     '#93b8ed',
          300:     '#5492e3',
          400:     '#2470d5',
          500:     '#0066cc',
          600:     '#0057b3',
          700:     '#004899',
          800:     '#003a80',
          900:     '#002c66',
          950:     '#001a40',
        },
        // Apple Neutrals
        ink: {
          DEFAULT: '#1d1d1f',
          muted:   '#333333',
          soft:    '#7a7a7a',
        },
        canvas: {
          DEFAULT:   '#ffffff',
          parchment: '#f5f5f7',
          pearl:     '#fafafc',
        },
        surface: {
          tile1:  '#272729',
          tile2:  '#2a2a2c',
          tile3:  '#252527',
          black:  '#000000',
          chip:   '#d2d2d7',
        },
        divider: {
          soft:     '#f0f0f0',
          hairline: '#e0e0e0',
        },
        // Keep neutral for utility
        neutral: {
          0:   '#ffffff',
          50:  '#f5f5f7',
          100: '#f0f0f0',
          150: '#e8e8ed',
          200: '#e0e0e0',
          300: '#cccccc',
          400: '#7a7a7a',
          500: '#6e6e73',
          600: '#515154',
          700: '#3a3a3c',
          800: '#2c2c2e',
          900: '#1c1c1e',
          950: '#000000',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Helvetica Neue"',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
        display: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"Helvetica Neue"',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"SF Mono"', '"Fira Code"', 'monospace'],
      },
      fontSize: {
        '2xs':  ['0.625rem', { lineHeight: '1rem' }],
        'nav':  ['0.75rem',  { lineHeight: '1',    letterSpacing: '-0.12px' }],
        'cap':  ['0.875rem', { lineHeight: '1.43', letterSpacing: '-0.224px' }],
        'body': ['1.0625rem',{ lineHeight: '1.47', letterSpacing: '-0.374px' }],
        'tag':  ['1.3125rem',{ lineHeight: '1.19', letterSpacing: '0.231px' }],
        'lead': ['1.75rem',  { lineHeight: '1.14', letterSpacing: '0.196px' }],
        'disp': ['2.5rem',   { lineHeight: '1.1',  letterSpacing: '0' }],
        'hero': ['3.5rem',   { lineHeight: '1.07', letterSpacing: '-0.28px' }],
      },
      letterSpacing: {
        tightest: '-0.03em',
        tighter:  '-0.022em',
        tight:    '-0.011em',
        normal:   '-0.007px',
      },
      spacing: {
        '17': '4.25rem',   // md spacing token
        '22': '5.5rem',    // section breathing
        '80px': '5rem',
        'section': '5rem', // 80px section padding
      },
      borderRadius: {
        none:  '0px',
        xs:    '5px',
        sm:    '8px',
        md:    '11px',
        lg:    '18px',
        xl:    '22px',
        '2xl': '28px',
        pill:  '9999px',
        full:  '9999px',
      },
      transitionTimingFunction: {
        'apple':    'cubic-bezier(0.4, 0, 0.2, 1)',
        'spring':   'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth':   'cubic-bezier(0.4, 0, 0.2, 1)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      animation: {
        'fade-in':    'fadeIn 0.25s ease-out both',
        'fade-up':    'fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-down':  'fadeDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in':   'scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'slide-left': 'slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'shimmer':    'shimmer 1.8s infinite linear',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeDown: {
          from: { opacity: '0', transform: 'translateY(-10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        slideLeft: {
          from: { opacity: '0', transform: 'translateX(-14px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to:   { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        // Apple-style: only product imagery gets true drop shadows
        'product': '0 3px 30px 5px rgba(0,0,0,0.22)',
        'card':    '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover': '0 8px 28px -4px rgba(0,0,0,0.12), 0 3px 8px -2px rgba(0,0,0,0.06)',
        'sm':      '0 1px 4px 0 rgba(0,0,0,0.06)',
        'md':      '0 4px 12px -2px rgba(0,0,0,0.08)',
        'lg':      '0 12px 40px -6px rgba(0,0,0,0.14)',
        'focus':   '0 0 0 3px rgba(0,102,204,0.3)',
      },
    },
  },
  plugins: [],
}
