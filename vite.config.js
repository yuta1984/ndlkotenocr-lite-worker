import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'esnext',
    lib: {
      entry: {
        index: 'src/main.js',
        'worker/ocr-worker': 'src/worker/ocr-worker.js',
      },
      name: 'NDLKotenOCRWorker',
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
      external: [], // すべての依存関係をバンドルに含める
    },
    copyPublicDir: true,
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
    fs: {
      allow: ['..', 'models', 'node_modules'],
    },
    mimeTypes: {
      'application/wasm': ['wasm'],
    },
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
    include: ['onnxruntime-web > long'],
  },
  worker: {
    format: 'es',
    plugins: () => [],
  },
  publicDir: 'models',
  assetsInclude: ['**/*.onnx', '**/*.wasm'],
  define: {
    global: 'globalThis',
  },
});
