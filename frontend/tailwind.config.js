/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Mona Sans Variable"',
          '"Mona Sans"',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif'
        ]
      },
      colors: {
        brand: {
          50: '#fff7f7',
          100: '#feecec',
          200: '#fbd7d8',
          300: '#f5b5b7',
          400: '#eb8589',
          500: '#db565b',
          600: '#c83a40',
          700: '#b81f23',
          800: '#932226',
          900: '#792326',
          950: '#430d0f'
        }
      }
    }
  },
  plugins: []
};
