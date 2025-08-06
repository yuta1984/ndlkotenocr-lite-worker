/**
 * ファイルハンドラー
 * ファイル選択・ドラッグ&ドロップ機能を管理
 */

export class FileHandler {
  constructor() {
    this.eventListeners = new Map();
    this.acceptedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/bmp',
    ];
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
    this.setupElements();
  }

  /**
   * DOM要素の設定
   */
  setupElements() {
    this.fileInput = document.getElementById('file-input');
    this.dropZone = document.getElementById('drop-zone');
    this.fileInfo = document.getElementById('file-info');

    if (this.fileInput) {
      this.setupFileInput();
    }

    if (this.dropZone) {
      this.setupDropZone();
    }
  }

  /**
   * ファイル入力の設定
   */
  setupFileInput() {
    this.fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        this.handleFile(file);
      }
    });

    // ファイル入力の属性設定
    this.fileInput.accept = this.acceptedTypes.join(',');
  }

  /**
   * ドロップゾーンの設定
   */
  setupDropZone() {
    // ドラッグイベントのデフォルト動作を防止
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(
      (eventName) => {
        this.dropZone.addEventListener(
          eventName,
          this.preventDefaults,
          false
        );
        document.body.addEventListener(
          eventName,
          this.preventDefaults,
          false
        );
      }
    );

    // ドラッグ開始/終了時の視覚的フィードバック
    ['dragenter', 'dragover'].forEach((eventName) => {
      this.dropZone.addEventListener(eventName, () => {
        this.dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      this.dropZone.addEventListener(eventName, () => {
        this.dropZone.classList.remove('drag-over');
      });
    });

    // ファイルドロップ処理
    this.dropZone.addEventListener('drop', (event) => {
      const files = event.dataTransfer.files;
      if (files.length > 0) {
        this.handleFile(files[0]);
      }
    });

    // クリックでファイル選択ダイアログを開く
    this.dropZone.addEventListener('click', () => {
      if (this.fileInput && !this.fileInput.disabled) {
        this.fileInput.click();
      }
    });
  }

  /**
   * デフォルト動作の防止
   */
  preventDefaults(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * ファイル処理
   */
  handleFile(file) {
    console.log(
      'File selected:',
      file.name,
      file.type,
      file.size
    );

    // ファイル検証
    const validation = this.validateFile(file);
    if (!validation.isValid) {
      this.showError(validation.error);
      return;
    }

    // ファイル情報表示
    this.displayFileInfo(file);

    // ファイル選択イベントを発火
    this.emit('fileSelected', file);
  }

  /**
   * ファイル検証
   */
  validateFile(file) {
    // ファイルタイプチェック
    if (!this.acceptedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: `サポートされていないファイル形式です。対応形式: ${this.acceptedTypes.join(
          ', '
        )}`,
      };
    }

    // ファイルサイズチェック
    if (file.size > this.maxFileSize) {
      const maxSizeMB = Math.round(
        this.maxFileSize / (1024 * 1024)
      );
      return {
        isValid: false,
        error: `ファイルサイズが大きすぎます。最大サイズ: ${maxSizeMB}MB`,
      };
    }

    return { isValid: true };
  }

  /**
   * ファイル情報の表示
   */
  displayFileInfo(file) {
    if (!this.fileInfo) return;

    const sizeKB = Math.round(file.size / 1024);
    const sizeText =
      sizeKB > 1024
        ? `${Math.round((sizeKB / 1024) * 10) / 10}MB`
        : `${sizeKB}KB`;

    this.fileInfo.innerHTML = `
      <div class="file-info-item">
        <strong>ファイル名:</strong> ${this.escapeHtml(
          file.name
        )}
      </div>
      <div class="file-info-item">
        <strong>ファイルサイズ:</strong> ${sizeText}
      </div>
      <div class="file-info-item">
        <strong>ファイルタイプ:</strong> ${file.type}
      </div>
      <div class="file-info-item">
        <strong>最終更新:</strong> ${new Date(
          file.lastModified
        ).toLocaleString()}
      </div>
    `;

    this.fileInfo.classList.remove('hidden');
  }

  /**
   * HTMLエスケープ
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * エラー表示
   */
  showError(message) {
    console.error('File handler error:', message);

    // カスタムエラーイベントを発火
    this.emit('error', { message });

    // メッセージ要素があれば表示
    const messageElement = document.getElementById(
      'message-display'
    );
    if (messageElement) {
      messageElement.textContent = message;
      messageElement.className = 'message message-error';
      messageElement.classList.remove('hidden');

      setTimeout(() => {
        messageElement.classList.add('hidden');
      }, 5000);
    }
  }

  /**
   * ファイル情報をクリア
   */
  clearFileInfo() {
    if (this.fileInfo) {
      this.fileInfo.classList.add('hidden');
      this.fileInfo.innerHTML = '';
    }

    if (this.fileInput) {
      this.fileInput.value = '';
    }
  }

  /**
   * ドロップゾーンの状態設定
   */
  setEnabled(enabled) {
    if (this.dropZone) {
      if (enabled) {
        this.dropZone.classList.remove('disabled');
      } else {
        this.dropZone.classList.add('disabled');
      }
    }

    if (this.fileInput) {
      this.fileInput.disabled = !enabled;
    }
  }

  /**
   * 画像プレビューの表示
   */
  showImagePreview(file) {
    const previewContainer =
      document.getElementById('image-preview');
    if (!previewContainer) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      previewContainer.innerHTML = `
        <img src="${event.target.result}" alt="プレビュー" style="max-width: 100%; max-height: 300px; object-fit: contain;">
      `;
      previewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  /**
   * プレビューをクリア
   */
  clearPreview() {
    const previewContainer =
      document.getElementById('image-preview');
    if (previewContainer) {
      previewContainer.innerHTML = '';
      previewContainer.classList.add('hidden');
    }
  }

  /**
   * 複数ファイルの処理（将来の拡張用）
   */
  handleMultipleFiles(files) {
    const validFiles = [];
    const errors = [];

    for (const file of files) {
      const validation = this.validateFile(file);
      if (validation.isValid) {
        validFiles.push(file);
      } else {
        errors.push({
          file: file.name,
          error: validation.error,
        });
      }
    }

    if (errors.length > 0) {
      console.warn('Some files were rejected:', errors);
    }

    if (validFiles.length > 0) {
      this.emit('filesSelected', validFiles);
    }
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
          console.error(
            'Error in file handler event listener:',
            error
          );
        }
      });
    }
  }

  /**
   * サンプル画像を読み込み
   */
  async loadSampleImage() {
    try {
      // サンプル画像のパスを取得
      const samplePath = './sample.png';

      // fetch でサンプル画像を取得
      const response = await fetch(samplePath);
      if (!response.ok) {
        throw new Error('サンプル画像が見つかりません');
      }

      // Blob として取得
      const blob = await response.blob();

      // File オブジェクトを作成
      const file = new File([blob], 'sample.png', {
        type: 'image/png',
        lastModified: Date.now(),
      });

      // 通常のファイル処理と同じ処理を実行
      this.handleFile(file);

      console.log('Sample image loaded successfully');
    } catch (error) {
      console.error('Failed to load sample image:', error);
      this.showError(
        'サンプル画像の読み込みに失敗しました: ' +
          error.message
      );
    }
  }

  /**
   * リソースのクリーンアップ
   */
  dispose() {
    this.clearFileInfo();
    this.clearPreview();
    this.eventListeners.clear();
  }
}
