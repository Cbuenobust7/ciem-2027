/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Manual de Identidad Corporativa CIEM v1.0, pág. 06.
        master: {
          navy: '#101F65',
          cyan: '#06D69A',
          'cyan-dark': '#087DFA',
          peru: '#E21E2B',
          light: '#F5F8FF',
        },
        primary: {
          50: '#EEF6FF',
          100: '#DCEEFF',
          200: '#B8DCFF',
          300: '#8AC5FF',
          400: '#4DA1FF',
          500: '#087DFA',
          600: '#0668D3',
          700: '#0756AC',
          800: '#0B4587',
          900: '#101F65',
        },
        ciem: {
          green: '#06D69A',
          'green-light': '#E2FBF2',
          navy: '#101F65',
          action: '#087DFA',
        },
      },
      fontWeight: {
        thin: '300',
        extralight: '300',
        light: '300',
        normal: '400',
        medium: '400',
        semibold: '700',
        bold: '700',
        extrabold: '700',
        black: '700',
      },
      fontFamily: {
        sans: ['DejaVu Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
