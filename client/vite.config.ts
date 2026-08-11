import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    port: 5174,
    host: true,
    strictPort: true, // fail fast if port is taken, don't silently increment
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
    sourcemap: false,
  },
});
