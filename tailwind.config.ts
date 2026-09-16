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
        paper: "#F9F7F4",
        maroon: { DEFAULT: "#6E1423", dark: "#4E0E19" },
        steel: "#8B9097",
        grid: "#E4DCD7",
      },
      fontFamily: {
        sans: ['"Anuphan"', "system-ui", "sans-serif"],
        display: ['"Anuphan"', "system-ui", "sans-serif"],
        label: ['"Anuphan"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
