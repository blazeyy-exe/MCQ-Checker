import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: { format: "es" },
  optimizeDeps: {
    exclude: ["tesseract.js"],
  },
  server: {
    host: true,
    port: 5173,
  },
});
