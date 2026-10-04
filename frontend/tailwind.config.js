/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        biosync: {
          dark: "#0F172A",
          card: "#1E293B",
          border: "#334155",
          accent: "#3B82F6",
          green: "#10B981",
          amber: "#F59E0B",
          rose: "#F43F5E",
        },
      },
    },
  },
  plugins: [],
};
