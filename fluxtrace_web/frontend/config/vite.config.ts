import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const appRoot = path.resolve(import.meta.dirname, "..");
const webRoot = path.resolve(appRoot, "..");

const plugins = [react(), tailwindcss(), jsxLocPlugin()];

export default defineConfig({
  plugins,
  // Keep Vite/Vitest caches under fluxtrace_web (no spurious frontend/node_modules)
  cacheDir: path.resolve(webRoot, "node_modules", ".vite"),
  resolve: {
    alias: {
      "@": path.resolve(appRoot, "src"),
      "@backend": path.resolve(appRoot, "..", "backend"),
      "@shared": path.resolve(appRoot, "..", "backend", "shared"),
      "@assets": path.resolve(webRoot, "attached_assets"),
    },
  },
  envDir: webRoot,
  root: appRoot,
  publicDir: path.resolve(appRoot, "public"),
  build: {
    outDir: path.resolve(webRoot, "dist", "public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
