/**
 * NDLKotenOCR-Lite Worker
 * Web Worker based OCR library for classical Japanese texts
 */

// WebWorker URL を取得する関数
export function getWorkerUrl() {
  // Viteビルド時にWebWorkerファイルの正しいURLを返す
  return new URL('./worker/ocr-worker.js', import.meta.url);
}

// 高レベルAPIの提供（オプション）
export { workerMessageHandler } from './utils/message-handler.js';
export { FileHandler } from './ui/file-handler.js';
export { ResultDisplay } from './ui/result-display.js';

// WebWorkerを使用したOCR処理のヘルパークラス
export class NDLKotenOCR {
  constructor() {
    this.worker = null;
    this.initialized = false;
  }

  /**
   * WebWorkerを初期化
   */
  async initialize() {
    if (this.initialized) return;

    this.worker = new Worker(getWorkerUrl(), {
      type: 'module',
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker initialization timeout'));
      }, 30000);

      this.worker.onmessage = (event) => {
        const { type } = event.data;
        if (type === 'WORKER_READY') {
          clearTimeout(timeout);
          this.initialized = true;
          resolve();
        } else if (type === 'WORKER_ERROR') {
          clearTimeout(timeout);
          reject(new Error(event.data.error));
        }
      };

      this.worker.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };

      // 初期化メッセージを送信
      this.worker.postMessage({ type: 'INITIALIZE' });
    });
  }

  /**
   * OCR処理を実行
   * @param {ImageData|HTMLImageElement|File} imageInput - 画像データ
   * @param {Object} options - 処理オプション
   * @returns {Promise<Object>} OCR結果
   */
  async processImage(imageInput, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    // 画像データをImageDataに変換
    const imageData = await this._convertToImageData(
      imageInput
    );

    return new Promise((resolve, reject) => {
      const processId = Date.now().toString();

      const messageHandler = (event) => {
        const { type, id, ...data } = event.data;

        if (id !== processId) return;

        switch (type) {
          case 'OCR_PROGRESS':
            if (options.onProgress) {
              options.onProgress(data);
            }
            break;

          case 'OCR_COMPLETE':
            this.worker.removeEventListener(
              'message',
              messageHandler
            );
            resolve(data);
            break;

          case 'OCR_ERROR':
            this.worker.removeEventListener(
              'message',
              messageHandler
            );
            reject(new Error(data.error));
            break;
        }
      };

      this.worker.addEventListener(
        'message',
        messageHandler
      );

      // OCR処理開始
      this.worker.postMessage({
        type: 'OCR_PROCESS',
        id: processId,
        imageData: imageData,
        config: {
          outputFormats: options.outputFormats || ['txt'],
          ...options,
        },
      });
    });
  }

  /**
   * 画像入力をImageDataに変換
   */
  async _convertToImageData(imageInput) {
    if (imageInput instanceof ImageData) {
      return imageInput;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (imageInput instanceof File) {
      const img = new Image();
      return new Promise((resolve, reject) => {
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          resolve(
            ctx.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            )
          );
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(imageInput);
      });
    }

    if (imageInput instanceof HTMLImageElement) {
      canvas.width = imageInput.width;
      canvas.height = imageInput.height;
      ctx.drawImage(imageInput, 0, 0);
      return ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    throw new Error('Unsupported image input type');
  }

  /**
   * WebWorkerを終了
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.initialized = false;
    }
  }
}

// デフォルトエクスポート
export default NDLKotenOCR;
