/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sonic: {
          cyan: '#67e8f9',
          lime: '#bef264',
          amber: '#fbbf24',
          slate: '#0f172a',
          ink: '#071018',
        }
      },
      animation: {
        'sonic-pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      backgroundImage: {
        'gradient-sonic': 'linear-gradient(135deg, #67e8f9 0%, #bef264 100%)',
      },
      boxShadow: {
        'sonic': '0 18px 44px rgba(103, 232, 249, 0.16)',
      }
    },
  },
  plugins: [],
}

