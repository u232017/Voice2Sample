/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        freesound: {
          yellow: '#f5d442',
          orange: '#f5a742',
          green: '#88d442',
          dark: '#1a1a1a',
          darker: '#0a0a0a',
        }
      }
    },
  },
  plugins: [],
}
