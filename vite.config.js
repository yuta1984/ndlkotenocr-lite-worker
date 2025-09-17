import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

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
      input: {
        index: 'src/main.js',
        'worker/ocr-worker': 'src/worker/ocr-worker.js',
      },
      // 静的アセットのコピー設定
      external: [],
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        manualChunks: (id) => {
          // Worker関連の全てのファイル（model-loader含む）をチャンク分割しない
          if (
            id.includes('/worker/') ||
            id.includes('ocr-worker') ||
            id.includes('model-loader') ||
            id.includes('layout-detector') ||
            id.includes('text-recognizer') ||
            id.includes('reading-order') ||
            id.includes('onnx-config')
          ) {
            return null; // Worker関連はエントリーポイントに統合
          }
          // メインアプリ用のvendorチャンク（node_modules）
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          return null;
        },
      },
      // 静的ファイルのコピー処理
      plugins: [
        {
          name: 'copy-config-files',
          generateBundle() {
            // NDLmoji.yamlを出力ディレクトリにコピー
            const yamlPath = path.resolve(
              'config/NDLmoji.yaml'
            );
            if (fs.existsSync(yamlPath)) {
              this.emitFile({
                type: 'asset',
                fileName: 'config/NDLmoji.yaml',
                source: fs.readFileSync(yamlPath, 'utf8'),
              });
            }
          },
        },
      ],
      // Worker専用の設定追加
      onwarn: (warning, warn) => {
        // ビルド警告を適切にハンドル
        if (warning.code === 'CIRCULAR_DEPENDENCY') {
          return;
        }
        warn(warning);
      },
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
  assetsInclude: ['**/*.onnx', '**/*.wasm', '**/*.yaml'],
  define: {
    global: 'globalThis',
  },
});
