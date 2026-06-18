/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bobcat: {
          ink: '#101010',
          black: '#050505',
          charcoal: '#242424',
          red: '#b91c1c',
          gold: '#d7b46a',
          sand: '#f5f0e6',
          cream: '#fbfaf7',
          line: '#e6ddcf',
          green: '#14532d',
          lime: '#d7b46a',
          clay: '#b91c1c',
        },
      },
      boxShadow: {
        soft: '0 18px 50px rgba(16, 16, 16, 0.10)',
        card: '0 10px 30px rgba(16, 16, 16, 0.08)',
      },
    },
  },
  plugins: [],
};
