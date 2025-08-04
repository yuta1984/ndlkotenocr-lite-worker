/**
 * Web Worker通信管理モジュール
 * メインスレッドとWorker間の通信を管理
 */

export class WorkerMessageHandler {
  constructor() {
    this.worker = null;
    this.taskQueue = new Map();
    this.currentTaskId = null;
    this.isWorkerBusy = false;
    this.eventListeners = new Map();
  }

  /**
   * Workerの初期化
   */
  async initializeWorker() {
    if (this.worker) {
      this.terminateWorker();
    }

    try {
      // Viteの場合、Workerファイルのインポート方法
      this.worker = new Worker(
        new URL("../worker/ocr-worker.js", import.meta.url),
        { type: "module" }
      );

      this.setupWorkerEventHandlers();

      // Workerの初期化を待つ
      await this.sendMessage({ type: "INITIALIZE" });

      console.log("Worker initialized successfully");
      return true;
    } catch (error) {
      console.error("Failed to initialize worker:", error);
      throw error;
    }
  }

  /**
   * Workerイベントハンドラーの設定
   */
  setupWorkerEventHandlers() {
    this.worker.onmessage = (event) => {
      this.handleWorkerMessage(event.data);
    };

    this.worker.onerror = (error) => {
      console.error("Worker error:", error);
      this.emit("error", {
        type: "worker_error",
        error: error.message,
        filename: error.filename,
        lineno: error.lineno,
      });
    };

    this.worker.onmessageerror = (error) => {
      console.error("Worker message error:", error);
      this.emit("error", {
        type: "worker_message_error",
        error: error.message,
      });
    };
  }

  /**
   * Workerからのメッセージ処理
   */
  handleWorkerMessage(data) {
    const { type, id, ...payload } = data;

    switch (type) {
      case "OCR_PROGRESS":
        this.emit("progress", { id, ...payload });
        break;

      case "OCR_COMPLETE":
        this.handleTaskComplete(id, payload);
        break;

      case "OCR_ERROR":
        this.handleTaskError(id, payload);
        break;

      default:
        console.warn("Unknown worker message type:", type);
    }
  }

  /**
   * タスク完了の処理
   */
  handleTaskComplete(taskId, result) {
    const task = this.taskQueue.get(taskId);
    if (task) {
      task.resolve(result);
      this.taskQueue.delete(taskId);
    }

    this.isWorkerBusy = false;
    this.currentTaskId = null;
    this.emit("complete", { id: taskId, result });

    // 次のタスクを処理
    this.processNextTask();
  }

  /**
   * タスクエラーの処理
   */
  handleTaskError(taskId, error) {
    const task = this.taskQueue.get(taskId);
    if (task) {
      task.reject(new Error(error.error || "OCR processing failed"));
      this.taskQueue.delete(taskId);
    }

    this.isWorkerBusy = false;
    this.currentTaskId = null;
    this.emit("error", { id: taskId, ...error });

    // 次のタスクを処理
    this.processNextTask();
  }

  /**
   * OCR処理タスクの追加
   */
  async processOCR(imageData, config = {}) {
    return new Promise((resolve, reject) => {
      const taskId = this.generateTaskId();
      const task = {
        id: taskId,
        type: "OCR_PROCESS",
        imageData,
        config,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      this.taskQueue.set(taskId, task);

      if (!this.isWorkerBusy) {
        this.processNextTask();
      }
    });
  }

  /**
   * 次のタスクを処理
   */
  processNextTask() {
    if (this.isWorkerBusy || this.taskQueue.size === 0) {
      return;
    }

    // 最も古いタスクを取得
    const oldestTask = Array.from(this.taskQueue.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    )[0];

    if (oldestTask) {
      this.isWorkerBusy = true;
      this.currentTaskId = oldestTask.id;

      this.sendMessage({
        type: oldestTask.type,
        id: oldestTask.id,
        imageData: oldestTask.imageData,
        config: oldestTask.config,
      });
    }
  }

  /**
   * Workerにメッセージを送信
   */
  sendMessage(message) {
    if (!this.worker) {
      throw new Error("Worker not initialized");
    }

    return new Promise((resolve, reject) => {
      try {
        this.worker.postMessage(message);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * タスクIDの生成
   */
  generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 現在のタスクをキャンセル
   */
  cancelCurrentTask() {
    if (this.currentTaskId) {
      const task = this.taskQueue.get(this.currentTaskId);
      if (task) {
        task.reject(new Error("Task cancelled"));
        this.taskQueue.delete(this.currentTaskId);
      }

      this.isWorkerBusy = false;
      this.currentTaskId = null;

      // Workerを再初期化（処理を強制停止）
      this.terminateWorker();
      this.initializeWorker();
    }
  }

  /**
   * 全タスクをキャンセル
   */
  cancelAllTasks() {
    for (const task of this.taskQueue.values()) {
      task.reject(new Error("All tasks cancelled"));
    }
    this.taskQueue.clear();

    this.isWorkerBusy = false;
    this.currentTaskId = null;

    // Workerを再初期化
    this.terminateWorker();
    this.initializeWorker();
  }

  /**
   * キューの状態を取得
   */
  getQueueStatus() {
    return {
      queueSize: this.taskQueue.size,
      isWorkerBusy: this.isWorkerBusy,
      currentTaskId: this.currentTaskId,
      totalTasks: this.taskQueue.size + (this.isWorkerBusy ? 1 : 0),
    };
  }

  /**
   * イベントリスナーの追加
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  /**
   * イベントリスナーの削除
   */
  off(event, callback) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * イベントの発火
   */
  emit(event, data) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error("Error in event listener:", error);
        }
      });
    }
  }

  /**
   * Workerの終了
   */
  terminateWorker() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // 未完了タスクをエラーで終了
    for (const task of this.taskQueue.values()) {
      task.reject(new Error("Worker terminated"));
    }
    this.taskQueue.clear();

    this.isWorkerBusy = false;
    this.currentTaskId = null;
  }

  /**
   * リソースのクリーンアップ
   */
  dispose() {
    this.terminateWorker();
    this.eventListeners.clear();
  }
}

/**
 * シングルトンインスタンス
 */
export const workerMessageHandler = new WorkerMessageHandler();
