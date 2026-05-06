import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const appRoot = path.resolve(import.meta.dirname, "..");
const webRoot = path.resolve(appRoot, "..");

export default defineConfig({
  plugins: [react()],
  root: appRoot,
  cacheDir: path.resolve(webRoot, "node_modules", ".vite"),
  resolve: {
    alias: {
      "@": path.resolve(appRoot, "src"),
      "@backend": path.resolve(appRoot, "..", "backend"),
      "@shared": path.resolve(appRoot, "..", "backend", "shared"),
      "@assets": path.resolve(webRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/**/*.spec.ts",
      "src/**/*.spec.tsx",
    ],
  },
});
