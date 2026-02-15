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
          DEFAULT: '#4A7B58',
          50: '#e8f5ed',
          100: '#c9e6d4',
          200: '#a7d7b9',
          300: '#84c89e',
          400: '#67ba89',
          500: '#4A7B58',
          600: '#3e6a4c',
          700: '#32583f',
          800: '#264732',
          900: '#1a3524',
        },
        heart: '#F0C896', // Warm beige/gold for heart accent
      },
    },
  },
  plugins: [],
}
