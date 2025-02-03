/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'orange': '#FA4A19',
        'purple': 'rgb(91, 79, 245)',
        'darker-purple': 'rgb(59, 35, 241)',
        'lighter-purple': 'rgb(222, 221, 253)',
        'red': 'rgb(219, 0, 0)',
        'darker-red': 'rgb(169, 0, 0)',
        'lighter-black': 'rgb(21, 21, 21)'
      }
    },
  },
  plugins: [],
}

