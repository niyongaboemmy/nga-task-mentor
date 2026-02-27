import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/taskmentor",
  server: {
    port: 5173,
    host: true,
  },
  optimizeDeps: {
    include: ["sanitize-html", "jquery"],
  },
  resolve: {
    alias: {
      "sanitize-html": "sanitize-html",
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
