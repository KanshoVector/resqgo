/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        resq: {
          red: "#dc2626",
          dark: "#0f172a",
        },
      },
    },
  },
  plugins: [],
};
