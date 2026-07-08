import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c1e21",
        muted: "#74777d",
        soft: "#9a988f",
        paper: "#f7f6f2",
        sidebar: "#fbfaf7",
        active: "#eceae2",
        panel: "#ffffff",
        "panel-2": "#f7f6f2",
        line: "#e5e3dd",
        row: "#f0eee8",
        red: "#d3402a",
        green: "#0f7a4d",
        amber: "#b06a00",
        blue: "#4353ff",
        purple: "#6b46ff",
        breach: {
          blue: "#4353ff",
          green: "#0f7a4d",
          yellow: "#b06a00",
          red: "#d3402a",
          violet: "#6b46ff",
          cyan: "#0b7fc2",
        },
      },
      boxShadow: {
        panel: "0 1px 3px rgba(0, 0, 0, 0.05)",
        card: "0 1px 3px rgba(0, 0, 0, 0.05)",
      },
      backgroundImage: {
        "dot-grid": "radial-gradient(#e8e6df 1px, transparent 1px)",
      },
      backgroundSize: {
        "dot-grid": "22px 22px",
      },
    },
  },
  plugins: [],
};

export default config;
