import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Hanken Grotesk"', "sans-serif"],
      },
      colors: {
        brand: "#b80049",
        "brand-dark": "#8c0036",
        background: "#ffffff",
        surface: "#f5faff",
        "surface-bright": "#ffffff",
        border: "#dae4ec",
        text: "#141d23",
        "text-muted": "#5f5e5e",
        accent1: "#e2165f",
        accent2: "#ffb2be",
      },
      backgroundImage: {
        "panel-gradient": "linear-gradient(180deg, #ffffff 0%, #f5faff 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
