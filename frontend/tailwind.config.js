/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d7fe',
          300: '#a4bcfd',
          400: '#7a97fa',
          500: '#5a75f4',
          600: '#3d53e8',
          700: '#3141d4',
          800: '#2935ac',
          900: '#263288',
        },
      },
    },
  },
  plugins: [],
}
