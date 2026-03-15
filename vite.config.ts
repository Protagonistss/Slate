import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

const backendProxyTarget = process.env.VITE_BACKEND_PROXY_TARGET || "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: "editor",
  clearScreen: false,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./editor"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api/v1": {
        target: backendProxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: ["es2021", "chrome100"],
    minify: !process.env.TAURI_DEBUG,
    sourcemap: !!process.env.TAURI_DEBUG,
    // Monaco workers bundle the language services and are expected to be much larger
    // than Vite's default 500 kB warning threshold.
    chunkSizeWarningLimit: 6500,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("monaco-editor")) return "monaco";
          if (id.includes("node_modules")) return "vendor";
          return undefined;
        },
      },
    },
  },
});
