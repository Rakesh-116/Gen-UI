/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["\"Space Grotesk\"", "ui-sans-serif", "system-ui"],
        body: ["\"IBM Plex Sans\"", "ui-sans-serif", "system-ui"],
        mono: ["\"JetBrains Mono\"", "ui-monospace", "SFMono-Regular"]
      }
    }
  },
  plugins: []
};
