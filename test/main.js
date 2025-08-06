/**
 * NDLKotenOCR-Lite Worker メインエントリーポイント
 */

import { workerMessageHandler } from '../src/utils/message-handler.js';
import { FileHandler } from '../src/ui/file-handler.js';
import { ResultDisplay } from '../src/ui/result-display.js';
import {
  preloadAllModels,
  getCachedModels,
} from '../src/utils/model-loader.js';

class NDLKotenOCRApp {
  constructor() {
    this.fileHandler = null;
    this.resultDisplay = null;
    this.isInitialized = false;
    this.currentProcessing = null;
  }

  /**
   * アプリケーションの初期化
   */
  async initialize() {
    try {
      console.log('Initializing NDLKotenOCR Worker App...');

      // UI コンポーネントの初期化
      this.fileHandler = new FileHandler();
      this.resultDisplay = new ResultDisplay();

      // イベントリスナーの設定
      this.setupEventListeners();

      // Worker の初期化
      await workerMessageHandler.initializeWorker();

      // キャッシュされたモデルの確認
      const cachedModels = await getCachedModels();
      console.log('Cached models:', cachedModels);

      this.isInitialized = true;
      this.updateUI();

      console.log(
        'NDLKotenOCR Worker App initialized successfully'
      );
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError(
        'アプリケーションの初期化に失敗しました: ' +
          error.message
      );
    }
  }

  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    // ファイル選択/ドロップイベント
    this.fileHandler.on('fileSelected', (file) => {
      this.processFile(file);
    });

    // Worker進捗イベント
    workerMessageHandler.on('progress', (data) => {
      this.updateProgress(data);
    });

    // Worker完了イベント
    workerMessageHandler.on('complete', (data) => {
      this.handleProcessingComplete(data);
    });

    // Workerエラーイベント
    workerMessageHandler.on('error', (data) => {
      this.handleProcessingError(data);
    });

    // UIイベント
    this.setupUIEventListeners();
  }

  /**
   * UIイベントリスナーの設定
   */
  setupUIEventListeners() {
    // モデル事前ダウンロードボタン
    const preloadBtn = document.getElementById(
      'preload-models'
    );
    if (preloadBtn) {
      preloadBtn.addEventListener('click', () => {
        this.preloadModels();
      });
    }

    // サンプル使用ボタン
    const sampleBtn = document.getElementById(
      'use-sample-btn'
    );
    if (sampleBtn) {
      sampleBtn.addEventListener('click', () => {
        this.useSample();
      });
    }

    // 処理キャンセルボタン
    const cancelBtn = document.getElementById(
      'cancel-processing'
    );
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.cancelProcessing();
      });
    }
  }

  /**
   * ファイル処理の開始
   */
  async processFile(file) {
    if (!this.isInitialized) {
      this.showError(
        'アプリケーションが初期化されていません'
      );
      return;
    }

    if (this.currentProcessing) {
      this.showError('別の処理が実行中です');
      return;
    }

    try {
      console.log('Processing file:', file.name);
      this.currentProcessing = file;

      // ファイルを画像として読み込み
      const imageData = await this.loadImageFile(file);

      // 設定を取得
      const config = this.getProcessingConfig();

      // UI を処理中状態に更新
      this.updateProcessingState(true);
      this.resultDisplay.clear();

      // 画像データをResultDisplayに渡す（clearの後に設定）
      this.resultDisplay.setOriginalImageData(imageData);

      // OCR処理を開始
      const result = await workerMessageHandler.processOCR(
        imageData,
        config
      );

      console.log('OCR processing completed:', result);
    } catch (error) {
      console.error('File processing failed:', error);
      this.showError(
        'ファイル処理に失敗しました: ' + error.message
      );
    }
  }

  /**
   * 画像ファイルをImageDataとして読み込み
   */
  async loadImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const img = new Image();

        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            );
            resolve(imageData);
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = () =>
          reject(new Error('画像の読み込みに失敗しました'));
        img.src = event.target.result;
      };

      reader.onerror = () =>
        reject(
          new Error('ファイルの読み込みに失敗しました')
        );
      reader.readAsDataURL(file);
    });
  }

  /**
   * 処理設定の取得
   */
  getProcessingConfig() {
    const config = {
      outputFormats: ['txt', 'json', 'xml'],
      readingOrder: {
        direction: 'vertical',
        columnDirection: 'right-to-left',
      },
    };

    // 読み方向と列方向は固定値（縦書き、右から左）
    // デフォルトでテキスト、JSON、XMLを出力

    return config;
  }

  /**
   * 進捗の更新
   */
  updateProgress(data) {
    const { stage, progress, message } = data;

    console.log(
      `Progress: ${stage} - ${Math.round(
        progress * 100
      )}% - ${message}`
    );

    // プログレスバーの更新
    const progressBar =
      document.getElementById('progress-bar');
    const progressText =
      document.getElementById('progress-text');

    if (progressBar) {
      progressBar.value = progress * 100;
    }

    if (progressText) {
      progressText.textContent =
        message || `${Math.round(progress * 100)}%`;
    }
  }

  /**
   * 処理完了の処理
   */
  handleProcessingComplete(data) {
    console.log(
      'handleProcessingComplete received data:',
      data
    );
    const result = data.result;
    console.log('Extracted result:', result);

    console.log('Processing completed successfully');

    // 結果を表示
    this.resultDisplay.displayResults(result);

    // UI を通常状態に戻す
    this.updateProcessingState(false);
    this.currentProcessing = null;

    this.showSuccess(
      `OCR処理が完了しました。${
        result?.totalRegions || 'undefined'
      }個の領域から${
        result?.successfulRecognitions || 'undefined'
      }個のテキストを認識しました。`
    );
  }

  /**
   * 処理エラーの処理
   */
  handleProcessingError(data) {
    const { error } = data;

    console.error('Processing failed:', error);

    // UI を通常状態に戻す
    this.updateProcessingState(false);
    this.currentProcessing = null;

    this.showError('OCR処理に失敗しました: ' + error);
  }

  /**
   * モデルの事前ダウンロード
   */
  async preloadModels() {
    try {
      this.showInfo('モデルをダウンロード中...');

      await preloadAllModels((progress) => {
        this.updateProgress({
          stage: 'preload',
          progress,
          message: `モデルダウンロード中... ${Math.round(
            progress * 100
          )}%`,
        });
      });

      this.showSuccess(
        'モデルのダウンロードが完了しました'
      );
    } catch (error) {
      console.error('Model preload failed:', error);
      this.showError(
        'モデルのダウンロードに失敗しました: ' +
          error.message
      );
    }
  }

  /**
   * サンプル画像の使用
   */
  async useSample() {
    try {
      console.log('Loading sample image...');

      if (this.fileHandler) {
        await this.fileHandler.loadSampleImage();
        this.showInfo('サンプル画像を読み込みました');
      } else {
        this.showError(
          'ファイルハンドラーが初期化されていません'
        );
      }
    } catch (error) {
      console.error('Failed to use sample:', error);
      this.showError(
        'サンプル画像の読み込みに失敗しました: ' +
          error.message
      );
    }
  }

  /**
   * 処理のキャンセル
   */
  cancelProcessing() {
    if (this.currentProcessing) {
      workerMessageHandler.cancelCurrentTask();
      this.updateProcessingState(false);
      this.currentProcessing = null;
      this.showInfo('処理をキャンセルしました');
    }
  }

  /**
   * 処理状態の更新
   */
  updateProcessingState(isProcessing) {
    const elements = {
      fileInput: document.getElementById('file-input'),
      dropZone: document.getElementById('drop-zone'),
      processBtn: document.getElementById('process-btn'),
      cancelBtn: document.getElementById(
        'cancel-processing'
      ),
      progressContainer: document.getElementById(
        'progress-container'
      ),
    };

    if (isProcessing) {
      elements.fileInput?.setAttribute('disabled', '');
      elements.dropZone?.classList.add('disabled');
      elements.processBtn?.setAttribute('disabled', '');
      elements.cancelBtn?.removeAttribute('disabled');
      elements.progressContainer?.classList.remove(
        'hidden'
      );
    } else {
      elements.fileInput?.removeAttribute('disabled');
      elements.dropZone?.classList.remove('disabled');
      elements.processBtn?.removeAttribute('disabled');
      elements.cancelBtn?.setAttribute('disabled', '');
      elements.progressContainer?.classList.add('hidden');
    }
  }

  /**
   * UI状態の更新
   */
  updateUI() {
    const statusElement =
      document.getElementById('app-status');
    if (statusElement) {
      statusElement.textContent = this.isInitialized
        ? '準備完了'
        : '初期化中...';
      statusElement.className = this.isInitialized
        ? 'status-ready'
        : 'status-loading';
    }
  }

  /**
   * メッセージ表示（成功）
   */
  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  /**
   * メッセージ表示（エラー）
   */
  showError(message) {
    this.showMessage(message, 'error');
  }

  /**
   * メッセージ表示（情報）
   */
  showInfo(message) {
    this.showMessage(message, 'info');
  }

  /**
   * メッセージ表示
   */
  showMessage(message, type = 'info') {
    console.log(`[${type.toUpperCase()}]`, message);

    const messageElement = document.getElementById(
      'message-display'
    );
    if (messageElement) {
      messageElement.textContent = message;
      messageElement.className = `message message-${type}`;
      messageElement.classList.remove('hidden');

      // 5秒後に自動で隠す
      setTimeout(() => {
        messageElement.classList.add('hidden');
      }, 5000);
    }
  }

  /**
   * アプリケーションの終了処理
   */
  dispose() {
    if (this.fileHandler) {
      this.fileHandler.dispose();
    }
    if (this.resultDisplay) {
      this.resultDisplay.dispose();
    }

    workerMessageHandler.dispose();
    this.isInitialized = false;
  }
}

// アプリケーションのインスタンス作成とエクスポート
export const app = new NDLKotenOCRApp();

// DOMContentLoaded で初期化
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      app.initialize();
    });
  } else {
    app.initialize();
  }
}

// ページアンロード時のクリーンアップ
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    app.dispose();
  });
}
