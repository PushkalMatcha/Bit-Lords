/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          900: '#0c4a6e',
        },
        dev: {
          bg: '#0d1117',
          surface: '#161b22',
          border: '#30363d',
          accent: '#7c3aed',
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#ef4444',
          text: '#e6edf3',
          muted: '#8b949e'
        }
      }
    },
  },
  plugins: [],
}
