import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext",
    lib: {
      entry: "src/main.js",
      name: "NDLKotenOCRWorker",
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        format: "es",
      },
    },
    copyPublicDir: true,
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
    fs: {
      allow: ["..", "models", "node_modules"],
    },
    mimeTypes: {
      "application/wasm": ["wasm"],
    },
  },
  optimizeDeps: {
    exclude: ["onnxruntime-web"],
    include: ["onnxruntime-web > long"],
  },
  worker: {
    format: "es",
    plugins: () => [],
  },
  publicDir: "models",
  assetsInclude: ["**/*.onnx", "**/*.wasm"],
  define: {
    global: "globalThis",
  },
});
