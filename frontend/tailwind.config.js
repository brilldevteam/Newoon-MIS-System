/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefdf9',
          100: '#d6f7ef',
          500: '#1f9d83',
          600: '#157e6b',
          900: '#123b36'
        }
      }
    }
  },
  plugins: []
};
