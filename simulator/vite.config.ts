import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/simulator/" : "/",
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: false,
  },
}));