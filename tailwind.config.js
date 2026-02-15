/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3E6652',
          50: '#E0EDE4',
          100: '#C5DFC9',
          200: '#9EC8A8',
          300: '#7EB18A',
          400: '#5E9178',
          500: '#3E6652',
          600: '#2E5440',
          700: '#224030',
          800: '#162B20',
          900: '#0B1610',
        },
        amber: {
          DEFAULT: '#D4944C',
          50: '#F5EBD8',
          100: '#F0C88C',
          200: '#E8B06A',
          300: '#D4944C',
          400: '#C0803A',
          500: '#A06830',
          600: '#805028',
          700: '#603C1E',
        },
        ink: {
          DEFAULT: '#2C2C2C',
          soft: '#5A5A5A',
          muted: '#8A8A8A',
        },
        cream: '#FDFCF7',
        sand: '#F5F1EA',
        status: {
          ok: '#3E6652',
          notice: '#D4944C',
          urgent: '#C4645A',
          inactive: '#B8B3AD',
        },
      },
      fontFamily: {
        display: ['DM Serif Display', 'Georgia', 'serif'],
        sans: ['DM Sans', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'gt': '10px',
      },
    },
  },
  plugins: [],
}
