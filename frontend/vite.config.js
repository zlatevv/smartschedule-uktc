import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In Docker the frontend (nginx) proxies /api → backend:8000,
// so the API base URL is just "" (same origin). This is set via
// an environment variable at build time; falls back to empty string
// which works both in Docker (nginx proxy) and locally if you run
// the backend on localhost:8000 with the Vite dev server proxy below.
export default defineConfig({
  plugins: [react()],

  // Dev-server proxy so `npm run dev` still works without Docker
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
