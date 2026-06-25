/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts,scss}"
  ],
  theme: {
    extend: {
      colors: {
        saint: {
          primary: 'rgb(41, 54, 129)',       // Azul oscuro - sidebar, headers
          secondary: 'rgb(66, 116, 217)',    // Azul medio - botones, links activos
          accent: 'rgb(149, 204, 221)',      // Azul claro - bordes, highlights
          light: 'rgb(208, 231, 230)',       // Azul pálido - fondos, hover
          50: '#eef5fa',
          100: '#d0e7e6',                    // ~rgb(208,231,230)
          200: '#95ccdd',                    // ~rgb(149,204,221)
          300: '#6ba8d4',
          400: '#4274d9',                    // ~rgb(66,116,217)
          500: '#3a56a8',
          600: '#293681',                    // ~rgb(41,54,129)
          700: '#1f2a66',
          800: '#161d4a',
          900: '#0d1230',
        }
      },
      fontFamily: {
        inter: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
