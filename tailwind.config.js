/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Unica77 LL"', 'sans-serif'],
        mono: ['"Unica77 Mono LL"', 'monospace'],
      },
    },
  },
  plugins: [],
}
