import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// RULES.md §19 planned default port for the dashboard: 5173 (simulator is 5174).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
});
