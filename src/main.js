/**
 * NDLKotenOCR-Lite Worker メインエントリーポイント
 */

import { workerMessageHandler } from "./utils/message-handler.js";
import { FileHandler } from "./ui/file-handler.js";
import { ResultDisplay } from "./ui/result-display.js";
import { preloadAllModels, getCachedModels } from "./utils/model-loader.js";

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
      console.log("Initializing NDLKotenOCR Worker App...");

      // UI コンポーネントの初期化
      this.fileHandler = new FileHandler();
      this.resultDisplay = new ResultDisplay();

      // イベントリスナーの設定
      this.setupEventListeners();

      // Worker の初期化
      await workerMessageHandler.initializeWorker();

      // キャッシュされたモデルの確認
      const cachedModels = await getCachedModels();
      console.log("Cached models:", cachedModels);

      this.isInitialized = true;
      this.updateUI();

      console.log("NDLKotenOCR Worker App initialized successfully");
    } catch (error) {
      console.error("Failed to initialize app:", error);
      this.showError(
        "アプリケーションの初期化に失敗しました: " + error.message
      );
    }
  }

  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    // ファイル選択/ドロップイベント
    this.fileHandler.on("fileSelected", (file) => {
      this.processFile(file);
    });

    // Worker進捗イベント
    workerMessageHandler.on("progress", (data) => {
      this.updateProgress(data);
    });

    // Worker完了イベント
    workerMessageHandler.on("complete", (data) => {
      this.handleProcessingComplete(data);
    });

    // Workerエラーイベント
    workerMessageHandler.on("error", (data) => {
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
    const preloadBtn = document.getElementById("preload-models");
    if (preloadBtn) {
      preloadBtn.addEventListener("click", () => {
        this.preloadModels();
      });
    }

    // 処理キャンセルボタン
    const cancelBtn = document.getElementById("cancel-processing");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        this.cancelProcessing();
      });
    }

    // 設定変更
    const settingsForm = document.getElementById("settings-form");
    if (settingsForm) {
      settingsForm.addEventListener("change", (event) => {
        this.updateSettings(event);
      });
    }
  }

  /**
   * ファイル処理の開始
   */
  async processFile(file) {
    if (!this.isInitialized) {
      this.showError("アプリケーションが初期化されていません");
      return;
    }

    if (this.currentProcessing) {
      this.showError("別の処理が実行中です");
      return;
    }

    try {
      console.log("Processing file:", file.name);
      this.currentProcessing = file;

      // ファイルを画像として読み込み
      const imageData = await this.loadImageFile(file);

      // 設定を取得
      const config = this.getProcessingConfig();

      // UI を処理中状態に更新
      this.updateProcessingState(true);
      this.resultDisplay.clear();

      // OCR処理を開始
      const result = await workerMessageHandler.processOCR(imageData, config);

      console.log("OCR processing completed:", result);
    } catch (error) {
      console.error("File processing failed:", error);
      this.showError("ファイル処理に失敗しました: " + error.message);
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
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

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

        img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
        img.src = event.target.result;
      };

      reader.onerror = () =>
        reject(new Error("ファイルの読み込みに失敗しました"));
      reader.readAsDataURL(file);
    });
  }

  /**
   * 処理設定の取得
   */
  getProcessingConfig() {
    const config = {
      outputFormats: [],
      readingOrder: {
        direction: "vertical",
        columnDirection: "right-to-left",
      },
    };

    // UI からの設定を取得
    const xmlOutput = document.getElementById("output-xml");
    const jsonOutput = document.getElementById("output-json");
    const txtOutput = document.getElementById("output-txt");

    if (xmlOutput?.checked) config.outputFormats.push("xml");
    if (jsonOutput?.checked) config.outputFormats.push("json");
    if (txtOutput?.checked) config.outputFormats.push("txt");

    // デフォルトでテキスト出力を含める
    if (config.outputFormats.length === 0) {
      config.outputFormats.push("txt");
    }

    const direction = document.getElementById("reading-direction")?.value;
    const columnDirection = document.getElementById("column-direction")?.value;

    if (direction) config.readingOrder.direction = direction;
    if (columnDirection) config.readingOrder.columnDirection = columnDirection;

    return config;
  }

  /**
   * 進捗の更新
   */
  updateProgress(data) {
    const { stage, progress, message } = data;

    console.log(
      `Progress: ${stage} - ${Math.round(progress * 100)}% - ${message}`
    );

    // プログレスバーの更新
    const progressBar = document.getElementById("progress-bar");
    const progressText = document.getElementById("progress-text");

    if (progressBar) {
      progressBar.value = progress * 100;
    }

    if (progressText) {
      progressText.textContent = message || `${Math.round(progress * 100)}%`;
    }
  }

  /**
   * 処理完了の処理
   */
  handleProcessingComplete(data) {
    const { result } = data;

    console.log("Processing completed successfully");

    // 結果を表示
    this.resultDisplay.displayResults(result);

    // UI を通常状態に戻す
    this.updateProcessingState(false);
    this.currentProcessing = null;

    this.showSuccess(
      `OCR処理が完了しました。${result.totalRegions}個の領域から${result.successfulRecognitions}個のテキストを認識しました。`
    );
  }

  /**
   * 処理エラーの処理
   */
  handleProcessingError(data) {
    const { error } = data;

    console.error("Processing failed:", error);

    // UI を通常状態に戻す
    this.updateProcessingState(false);
    this.currentProcessing = null;

    this.showError("OCR処理に失敗しました: " + error);
  }

  /**
   * モデルの事前ダウンロード
   */
  async preloadModels() {
    try {
      this.showInfo("モデルをダウンロード中...");

      await preloadAllModels((progress) => {
        this.updateProgress({
          stage: "preload",
          progress,
          message: `モデルダウンロード中... ${Math.round(progress * 100)}%`,
        });
      });

      this.showSuccess("モデルのダウンロードが完了しました");
    } catch (error) {
      console.error("Model preload failed:", error);
      this.showError("モデルのダウンロードに失敗しました: " + error.message);
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
      this.showInfo("処理をキャンセルしました");
    }
  }

  /**
   * 設定の更新
   */
  updateSettings(event) {
    const { target } = event;
    console.log("Settings updated:", target.name, target.value);
  }

  /**
   * 処理状態の更新
   */
  updateProcessingState(isProcessing) {
    const elements = {
      fileInput: document.getElementById("file-input"),
      dropZone: document.getElementById("drop-zone"),
      processBtn: document.getElementById("process-btn"),
      cancelBtn: document.getElementById("cancel-processing"),
      progressContainer: document.getElementById("progress-container"),
    };

    if (isProcessing) {
      elements.fileInput?.setAttribute("disabled", "");
      elements.dropZone?.classList.add("disabled");
      elements.processBtn?.setAttribute("disabled", "");
      elements.cancelBtn?.removeAttribute("disabled");
      elements.progressContainer?.classList.remove("hidden");
    } else {
      elements.fileInput?.removeAttribute("disabled");
      elements.dropZone?.classList.remove("disabled");
      elements.processBtn?.removeAttribute("disabled");
      elements.cancelBtn?.setAttribute("disabled", "");
      elements.progressContainer?.classList.add("hidden");
    }
  }

  /**
   * UI状態の更新
   */
  updateUI() {
    const statusElement = document.getElementById("app-status");
    if (statusElement) {
      statusElement.textContent = this.isInitialized
        ? "準備完了"
        : "初期化中...";
      statusElement.className = this.isInitialized
        ? "status-ready"
        : "status-loading";
    }
  }

  /**
   * メッセージ表示（成功）
   */
  showSuccess(message) {
    this.showMessage(message, "success");
  }

  /**
   * メッセージ表示（エラー）
   */
  showError(message) {
    this.showMessage(message, "error");
  }

  /**
   * メッセージ表示（情報）
   */
  showInfo(message) {
    this.showMessage(message, "info");
  }

  /**
   * メッセージ表示
   */
  showMessage(message, type = "info") {
    console.log(`[${type.toUpperCase()}]`, message);

    const messageElement = document.getElementById("message-display");
    if (messageElement) {
      messageElement.textContent = message;
      messageElement.className = `message message-${type}`;
      messageElement.classList.remove("hidden");

      // 5秒後に自動で隠す
      setTimeout(() => {
        messageElement.classList.add("hidden");
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
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      app.initialize();
    });
  } else {
    app.initialize();
  }
}

// ページアンロード時のクリーンアップ
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    app.dispose();
  });
}
