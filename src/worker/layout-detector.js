/**
 * レイアウト検出モジュール
 * RTMDet-sモデルを使用してテキスト領域を検出
 */

import * as ort from "onnxruntime-web";

export class LayoutDetector {
  constructor() {
    this.session = null;
    this.inputSize = { width: 1280, height: 1280 };
    this.initialized = false;
  }

  /**
   * モデルの初期化
   */
  async initialize(modelData) {
    if (this.initialized) return;

    try {
      this.session = await ort.InferenceSession.create(modelData, {
        executionProviders: ["wasm"],
        logSeverityLevel: 4,
      });
      this.initialized = true;
      console.log("Layout detector initialized successfully");
    } catch (error) {
      console.error("Failed to initialize layout detector:", error);
      throw error;
    }
  }

  /**
   * 画像からテキスト領域を検出
   */
  async detect(imageData, onProgress) {
    if (!this.initialized) {
      throw new Error("Layout detector not initialized");
    }

    try {
      // 1. 画像の前処理
      if (onProgress) onProgress(0.1);
      const { tensor, originalSize, scaleFactor } = await this.preprocessImage(
        imageData
      );

      // 2. 推論実行
      if (onProgress) onProgress(0.5);
      const output = await this.runInference(tensor);

      // 3. 後処理（NMS等）
      if (onProgress) onProgress(0.8);
      const detections = this.postprocessOutput(
        output,
        originalSize,
        scaleFactor
      );

      if (onProgress) onProgress(1.0);
      return detections;
    } catch (error) {
      console.error("Layout detection failed:", error);
      throw error;
    }
  }

  /**
   * 画像の前処理
   */
  async preprocessImage(imageData) {
    return new Promise((resolve, reject) => {
      try {
        const canvas = new OffscreenCanvas(1, 1);
        const ctx = canvas.getContext("2d");

        // ImageDataから画像を復元
        const imageCanvas = new OffscreenCanvas(
          imageData.width,
          imageData.height
        );
        const imageCtx = imageCanvas.getContext("2d");
        imageCtx.putImageData(imageData, 0, 0);

        const originalSize = {
          width: imageData.width,
          height: imageData.height,
        };

        // リサイズ比率の計算
        const scaleX = this.inputSize.width / originalSize.width;
        const scaleY = this.inputSize.height / originalSize.height;
        const scaleFactor = Math.min(scaleX, scaleY);

        const newWidth = Math.round(originalSize.width * scaleFactor);
        const newHeight = Math.round(originalSize.height * scaleFactor);

        // キャンバスをリサイズして画像を描画
        canvas.width = this.inputSize.width;
        canvas.height = this.inputSize.height;

        // 背景を黒で塗りつぶし
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, this.inputSize.width, this.inputSize.height);

        // 中央に配置してリサイズした画像を描画
        const offsetX = (this.inputSize.width - newWidth) / 2;
        const offsetY = (this.inputSize.height - newHeight) / 2;

        ctx.drawImage(imageCanvas, offsetX, offsetY, newWidth, newHeight);

        // ImageDataを取得
        const resizedImageData = ctx.getImageData(
          0,
          0,
          this.inputSize.width,
          this.inputSize.height
        );

        // RGB値を正規化してテンソルに変換 [1, 3, H, W]
        const tensor = new Float32Array(
          1 * 3 * this.inputSize.height * this.inputSize.width
        );
        const { data } = resizedImageData;

        for (let i = 0; i < this.inputSize.height * this.inputSize.width; i++) {
          // RGB順で正規化 (0-255 -> 0-1)
          tensor[i] = data[i * 4] / 255.0; // R
          tensor[this.inputSize.height * this.inputSize.width + i] =
            data[i * 4 + 1] / 255.0; // G
          tensor[this.inputSize.height * this.inputSize.width * 2 + i] =
            data[i * 4 + 2] / 255.0; // B
        }

        const inputTensor = new ort.Tensor("float32", tensor, [
          1,
          3,
          this.inputSize.height,
          this.inputSize.width,
        ]);

        resolve({
          tensor: inputTensor,
          originalSize,
          scaleFactor: {
            x: scaleFactor,
            y: scaleFactor,
            offsetX,
            offsetY,
          },
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 推論実行
   */
  async runInference(inputTensor) {
    const feeds = { images: inputTensor };
    const results = await this.session.run(feeds);
    return results;
  }

  /**
   * 後処理（検出結果の解析）
   */
  postprocessOutput(output, originalSize, scaleFactor) {
    const detections = [];

    try {
      // RTMDetの出力形式に応じて解析
      // 通常は [num_detections, 6] の形式 (x1, y1, x2, y2, confidence, class_id)
      const outputKeys = Object.keys(output);
      const outputTensor = output[outputKeys[0]]; // 最初の出力テンソルを使用

      const outputData = outputTensor.data;
      const numDetections = outputTensor.dims[0];
      const numValues = outputTensor.dims[1]; // 通常は6 (bbox + conf + class)

      for (let i = 0; i < numDetections; i++) {
        const offset = i * numValues;

        const x1 = outputData[offset];
        const y1 = outputData[offset + 1];
        const x2 = outputData[offset + 2];
        const y2 = outputData[offset + 3];
        const confidence = outputData[offset + 4];
        const classId = outputData[offset + 5] || 0;

        // 信頼度でフィルタリング
        if (confidence < 0.3) continue;

        // 座標を元の画像サイズに変換
        const originalX1 = Math.max(
          0,
          (x1 - scaleFactor.offsetX) / scaleFactor.x
        );
        const originalY1 = Math.max(
          0,
          (y1 - scaleFactor.offsetY) / scaleFactor.y
        );
        const originalX2 = Math.min(
          originalSize.width,
          (x2 - scaleFactor.offsetX) / scaleFactor.x
        );
        const originalY2 = Math.min(
          originalSize.height,
          (y2 - scaleFactor.offsetY) / scaleFactor.y
        );

        const width = originalX2 - originalX1;
        const height = originalY2 - originalY1;

        // 最小サイズフィルタ
        if (width < 10 || height < 10) continue;

        detections.push({
          x: Math.round(originalX1),
          y: Math.round(originalY1),
          width: Math.round(width),
          height: Math.round(height),
          confidence: confidence,
          classId: classId,
        });
      }

      // Non-Maximum Suppression (NMS) を適用
      const filteredDetections = this.applyNMS(detections, 0.5);

      console.log(
        `Layout detection completed: ${filteredDetections.length} regions found`
      );
      return filteredDetections;
    } catch (error) {
      console.error("Error in postprocessing:", error);
      return [];
    }
  }

  /**
   * Non-Maximum Suppression (NMS) の適用
   */
  applyNMS(detections, iouThreshold = 0.5) {
    if (detections.length === 0) return [];

    // 信頼度で降順ソート
    detections.sort((a, b) => b.confidence - a.confidence);

    const keep = [];
    const suppressed = new Set();

    for (let i = 0; i < detections.length; i++) {
      if (suppressed.has(i)) continue;

      keep.push(detections[i]);

      for (let j = i + 1; j < detections.length; j++) {
        if (suppressed.has(j)) continue;

        const iou = this.calculateIoU(detections[i], detections[j]);
        if (iou > iouThreshold) {
          suppressed.add(j);
        }
      }
    }

    return keep;
  }

  /**
   * IoU (Intersection over Union) の計算
   */
  calculateIoU(boxA, boxB) {
    const xA = Math.max(boxA.x, boxB.x);
    const yA = Math.max(boxA.y, boxB.y);
    const xB = Math.min(boxA.x + boxA.width, boxB.x + boxB.width);
    const yB = Math.min(boxA.y + boxA.height, boxB.y + boxB.height);

    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    const boxAArea = boxA.width * boxA.height;
    const boxBArea = boxB.width * boxB.height;

    const iou = interArea / (boxAArea + boxBArea - interArea);
    return iou;
  }

  /**
   * リソースの解放
   */
  dispose() {
    if (this.session) {
      this.session.release();
      this.session = null;
    }
    this.initialized = false;
  }
}
