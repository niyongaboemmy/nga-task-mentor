import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "production" ? "/" : "/taskmentor/",
  server: {
    port: 5173,
    host: true,
    strictPort: true, // fail fast if port is taken, don't silently increment
    proxy: {
      // Forward all /api/* requests to Express backend in dev
      "/api": {
        target: "http://localhost:5002",
        changeOrigin: true,
      },
    },
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
}));
