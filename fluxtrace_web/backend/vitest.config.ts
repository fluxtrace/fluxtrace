import path from "node:path";
import { defineConfig } from "vitest/config";

const backendRoot = path.resolve(import.meta.dirname);
const webRoot = path.resolve(backendRoot, "..");

export default defineConfig({
  root: backendRoot,
  /** Evita criar `backend/node_modules/.vite` (só cache); fica em `fluxtrace_web/.cache/` (gitignored). */
  cacheDir: path.join(webRoot, ".cache", "vitest-backend"),
  resolve: {
    alias: {
      "@": path.resolve(webRoot, "frontend", "src"),
      "@backend": backendRoot,
      "@shared": path.resolve(backendRoot, "shared"),
      "@assets": path.resolve(webRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.spec.ts"],
    exclude: ["node_modules/**"],
  },
});
