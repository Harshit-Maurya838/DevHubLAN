/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#1E1E2E', // background
          800: '#28283E', // sidebar/card
          700: '#343450', // hover
        },
        primary: {
          500: '#7289DA', // Discord blue
          600: '#5B6EAE',
        }
      }
    },
  },
  plugins: [],
}
