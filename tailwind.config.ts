import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f8fafc",
        panel: "#ffffff",
        accent: "#0f766e",
        accentDark: "#115e59"
      },
      boxShadow: {
        panel: "0 10px 30px rgba(2, 6, 23, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
