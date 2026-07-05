import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#241016",
        paper: "#F5F1EC",
        maroon: { DEFAULT: "#6E1423", dark: "#4E0E19" },
        steel: "#8B9097",
        grid: "#E4DCD7",
      },
      fontFamily: {
        sans: ['"Sarabun"', "system-ui", "sans-serif"],
        display: ['"Noto Serif Thai"', "Georgia", "serif"],
        label: ['"Sarabun"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
