/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts,scss}"
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#00CEC8',
          50: '#E6FFFE',
          100: '#CCFFFD',
          200: '#99FFFB',
          300: '#66FFF9',
          400: '#33FFF7',
          500: '#00CEC8',
          600: '#00A8A3',
          700: '#007F7B',
          800: '#005654',
          900: '#002D2C',
        },
        cream: {
          DEFAULT: '#FCEFC3',
          50: '#FFFDF5',
          100: '#FEFAEB',
          200: '#FDF5D7',
          300: '#FCEFC3',
          400: '#FAEA9F',
          500: '#F8E57B',
        },
        peach: {
          DEFAULT: '#FF9C5F',
          50: '#FFF4ED',
          100: '#FFE9DB',
          200: '#FFD3B7',
          300: '#FFBD93',
          400: '#FFA76F',
          500: '#FF9C5F',
          600: '#FF7B2E',
        },
        orange: {
          DEFAULT: '#EB4203',
          50: '#FEF2EE',
          100: '#FDE3DB',
          200: '#FBC5B5',
          300: '#F89E82',
          400: '#F4714E',
          500: '#EB4203',
          600: '#D43B03',
          700: '#B03202',
        },
      },
      fontFamily: {
        quicksand: ['Quicksand', 'sans-serif'],
        inter: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
