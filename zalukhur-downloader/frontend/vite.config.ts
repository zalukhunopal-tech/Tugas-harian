import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const backend = process.env.VITE_BACKEND ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": backend } },
  preview: { port: 4173, proxy: { "/api": backend } },
  // maplibre-gl sendiri ~1 MB; ini bukan regresi ukuran aplikasi.
  build: { chunkSizeWarningLimit: 1500 },
  test: { include: ["src/**/*.test.ts"] },
});
