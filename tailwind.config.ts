import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./content/**/*.mdx",
  ],
  theme: {
    extend: {
      colors: {
        // Workframe tokens (PRD Section 7)
        bg: token("bg"),
        surface: token("surface"),
        "surface-alt": token("surface-alt"),
        primary: { DEFAULT: token("primary"), foreground: token("ink") },
        secondary: { DEFAULT: token("secondary"), foreground: token("ink") },
        ink: token("ink"),
        muted: { DEFAULT: token("muted"), foreground: token("muted") },
        border: token("border"),
        danger: token("danger"),

        // Aliases so the shadcn/ui components pick up the same tokens.
        // Text on primary is ink, never white (white on #FF6B35 fails contrast).
        background: token("bg"),
        foreground: token("ink"),
        card: { DEFAULT: token("surface"), foreground: token("ink") },
        popover: { DEFAULT: token("surface"), foreground: token("ink") },
        accent: { DEFAULT: token("surface-alt"), foreground: token("ink") },
        destructive: { DEFAULT: token("danger"), foreground: token("surface") },
        input: token("border"),
        ring: token("primary"),
      },
      // 10px base unit. Use these for padding, gaps and margins:
      //   p-u1 = 10px, p-u2 = 20px, gap-u3 = 30px, mt-u6 = 60px ...
      // The default Tailwind scale stays too, because the shadcn/ui
      // components are written against it.
      spacing: {
        u1: "10px",
        u2: "20px",
        u3: "30px",
        u4: "40px",
        u5: "50px",
        u6: "60px",
        u7: "70px",
        u8: "80px",
        u9: "90px",
        u10: "100px",
      },
      minHeight: {
        tap: "44px",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        heading: [
          "var(--font-cabinet)",
          "var(--font-geist-sans)",
          "system-ui",
          "sans-serif",
        ],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
