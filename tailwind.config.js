/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      sm: '640px',
      md: '810px',
      lg: '1200px',
      xl: '1440px',
    },
    extend: {
      fontFamily: {
        sans: ['"Unica77 LL"', 'sans-serif'],
        mono: ['"Unica77 Mono LL"', 'monospace'],
      },
    },
  },
  plugins: [],
}
