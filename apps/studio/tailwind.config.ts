import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#eef6ff",
        muted: "#9db0c5",
        panel: "#121923",
        "panel-2": "#17212d",
        line: "#2b3948",
        breach: {
          blue: "#66b3ff",
          green: "#60d394",
          yellow: "#ffd166",
          red: "#ff6b6b",
          violet: "#b69cff",
          cyan: "#5ce1e6",
        },
      },
      boxShadow: {
        panel: "0 18px 60px rgba(0, 0, 0, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
