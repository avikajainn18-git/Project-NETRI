import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// RULES.md §19 planned default port for the simulator: 5174.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: false, // fall back to 5175+ if 5174 is taken (ports are configurable)
  },
});
