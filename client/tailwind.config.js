/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3D5AF1',
          50: '#E8ECFD',
          100: '#D1D9FB',
          200: '#A3B3F7',
          300: '#758DF3',
          400: '#4766F2',
          500: '#3D5AF1',
          600: '#1134DC',
          700: '#0D28A8',
          800: '#091C74',
          900: '#051040',
        },
        secondary: {
          DEFAULT: '#22DFBF',
          50: '#E4FAF7',
          100: '#C9F5EF',
          200: '#93EBDF',
          300: '#5DE1CF',
          400: '#27D7BF',
          500: '#22DFBF',
          600: '#1BAB92',
          700: '#147865',
          800: '#0D4539',
          900: '#06120D',
        },
        dark: {
          DEFAULT: '#121826',
          50: '#F2F3F5',
          100: '#E5E7EB',
          200: '#CBD0D7',
          300: '#B0B9C3',
          400: '#96A2AF',
          500: '#7C8B9B',
          600: '#637282',
          700: '#4A5568',
          800: '#323B4E',
          900: '#121826',
        },
        light: '#F7F9FC',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glass: '0 4px 30px rgba(0, 0, 0, 0.1)',
        glow: '0 0 15px rgba(61, 90, 241, 0.5)',
        'glow-teal': '0 0 15px rgba(34, 223, 191, 0.5)',
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
        'card-gradient': 'linear-gradient(135deg, rgba(61, 90, 241, 0.05), rgba(34, 223, 191, 0.05))',
        'blue-gradient': 'linear-gradient(135deg, #3D5AF1, #22DFBF)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glow-pulse 4s infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 15px rgba(61, 90, 241, 0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(61, 90, 241, 0.6)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};