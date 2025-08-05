/**
 * レイアウト検出モジュール
 * RTMDet-sモデルを使用してテキスト領域を検出
 */

import { ort, createSession } from "./onnx-config.js";

export class LayoutDetector {
  constructor() {
    this.session = null;
    this.inputSize = { width: 1024, height: 1024 };
    this.initialized = false;
  }

  /**
   * モデルの初期化
   */
  async initialize(modelData) {
    if (this.initialized) return;

    try {
      this.session = await createSession(modelData);
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
      console.log("[Detect] 入力画像の取得");
      // 1. 画像の前処理
      if (onProgress) onProgress(0.1);
      const { tensor, originalSize, metadata } = await this.preprocessImage(
        imageData
      );

      // 2. 推論実行
      if (onProgress) onProgress(0.5);
      const output = await this.runInference(tensor);

      // 3. 後処理（NMS等）
      if (onProgress) onProgress(0.8);
      const detections = this.postprocessOutput(output, metadata);

      if (onProgress) onProgress(1.0);
      console.log(`[Detect] 検出数（NMS後）: ${detections.length}`);
      return detections;
    } catch (error) {
      console.error("Layout detection failed:", error);
      throw error;
    }
  }

  /**
   * 画像の前処理（参考版に基づく改良版）
   */
  async preprocessImage(imageData) {
    return new Promise((resolve, reject) => {
      try {
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

        // 参考版と同様に、正方形のパディング画像を作成
        const maxWH = Math.max(originalSize.width, originalSize.height);

        // 正方形パディング用のキャンバス
        const paddingCanvas = new OffscreenCanvas(maxWH, maxWH);
        const paddingCtx = paddingCanvas.getContext("2d");

        // 背景を黒で塗りつぶし
        paddingCtx.fillStyle = "rgb(0, 0, 0)";
        paddingCtx.fillRect(0, 0, maxWH, maxWH);

        // 元の画像を左上に配置（参考版と同様）
        paddingCtx.drawImage(imageCanvas, 0, 0);

        // パディングされた画像をモデルの入力サイズにリサイズ
        const canvas = new OffscreenCanvas(
          this.inputSize.width,
          this.inputSize.height
        );
        const ctx = canvas.getContext("2d");

        // パディングされた画像をリサイズ
        ctx.drawImage(
          paddingCanvas,
          0,
          0,
          maxWH,
          maxWH,
          0,
          0,
          this.inputSize.width,
          this.inputSize.height
        );

        // ImageDataを取得
        const resizedImageData = ctx.getImageData(
          0,
          0,
          this.inputSize.width,
          this.inputSize.height
        );

        const { data } = resizedImageData;

        // Float32Arrayに変換し、ImageNet標準の正規化を適用
        // NHWC (バッチ, 高さ, 幅, チャンネル) から NCHW (バッチ, チャンネル, 高さ, 幅) に変換
        const tensor = new Float32Array(
          1 * 3 * this.inputSize.height * this.inputSize.width
        );

        // ImageNet標準の正規化パラメータ
        const mean = [123.675, 116.28, 103.53]; // RGB
        const std = [58.395, 57.12, 57.375]; // RGB

        // 画素データの変換と正規化
        for (let h = 0; h < this.inputSize.height; h++) {
          for (let w = 0; w < this.inputSize.width; w++) {
            const pixelOffset = (h * this.inputSize.width + w) * 4; // RGBA

            // RGB値を取得し、ImageNet標準で正規化
            for (let c = 0; c < 3; c++) {
              const value = data[pixelOffset + c];
              // NCHW形式でのインデックス計算
              const tensorIdx =
                c * this.inputSize.height * this.inputSize.width +
                h * this.inputSize.width +
                w;
              // 正規化: (pixel - mean) / std
              tensor[tensorIdx] = (value - mean[c]) / std[c];
            }
          }
        }

        const inputTensor = new ort.Tensor("float32", tensor, [
          1,
          3,
          this.inputSize.height,
          this.inputSize.width,
        ]);

        // メタデータを返す（後処理で使用）
        const metadata = {
          originalWidth: originalSize.width,
          originalHeight: originalSize.height,
          maxWH: maxWH,
          inputWidth: this.inputSize.width,
          inputHeight: this.inputSize.height,
        };

        resolve({
          tensor: inputTensor,
          originalSize,
          metadata,
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
    const feeds = { input: inputTensor };
    const results = await this.session.run(feeds);
    return results;
  }

  /**
   * 後処理（検出結果の解析）- 参考版に基づく改良版
   */
  postprocessOutput(output, metadata) {
    const detections = [];

    try {
      // RTMDetの出力形式を確認
      const outputKeys = Object.keys(output);
      console.log("[Postprocess] 出力キー:", outputKeys);

      // 参考版のように'dets'と'labels'キーを探す
      let detsData, labelsData;
      if (output["dets"] && output["labels"]) {
        // 参考版と同じ形式
        detsData = output["dets"].data;
        labelsData = output["labels"].data;
      } else {
        // 汎用的な出力形式の場合
        const outputTensor = output[outputKeys[0]];
        const outputData = outputTensor.data;
        const numDetections = outputTensor.dims[0];
        const numValues = outputTensor.dims[1];

        // データを分割してdetsとlabelsに変換
        detsData = [];
        labelsData = [];
        for (let i = 0; i < numDetections; i++) {
          const offset = i * numValues;
          // x1, y1, x2, y2, confidence
          for (let j = 0; j < 5; j++) {
            detsData.push(outputData[offset + j]);
          }
          // class_id
          labelsData.push(outputData[offset + 5] || 0);
        }
      }

      const numDetections = detsData.length / 5;
      console.log(`[Postprocess] NMS前 検出数: ${numDetections}`);

      for (let i = 0; i < numDetections; i++) {
        const x1 = detsData[i * 5 + 0];
        const y1 = detsData[i * 5 + 1];
        const x2 = detsData[i * 5 + 2];
        const y2 = detsData[i * 5 + 3];
        const score = detsData[i * 5 + 4];
        const classId = Number(labelsData[i]);

        // 信頼度でフィルタリング
        if (score < 0.3) continue;

        // 参考版と同様の座標変換: 入力画像サイズ → 元画像サイズ
        const normX1 = x1 / this.inputSize.width;
        const normY1 = y1 / this.inputSize.height;
        const normX2 = x2 / this.inputSize.width;
        const normY2 = y2 / this.inputSize.height;

        const squareSize = metadata.maxWH;
        const origX1 = normX1 * squareSize;
        const origY1 = normY1 * squareSize;
        const origX2 = normX2 * squareSize;
        const origY2 = normY2 * squareSize;

        // 参考版と同様にバウンディングボックスを上下2%拡張
        const boxHeight = origY2 - origY1;
        const deltaH = boxHeight * 0.02;

        const finalX1 = Math.max(0, Math.round(origX1));
        const finalY1 = Math.max(0, Math.round(origY1 - deltaH)); // 上方向に拡張
        const finalX2 = Math.min(metadata.originalWidth, Math.round(origX2));
        const finalY2 = Math.min(
          metadata.originalHeight,
          Math.round(origY2 + deltaH) // 下方向に拡張
        );

        const width = finalX2 - finalX1;
        const height = finalY2 - finalY1;

        // 最小サイズフィルタ
        if (width < 10 || height < 10) continue;

        detections.push({
          x: finalX1,
          y: finalY1,
          width: width,
          height: height,
          confidence: score,
          classId: classId,
        });
      }

      // Non-Maximum Suppression (NMS) を適用
      const filteredDetections = this.applyNMS(detections, 0.5);

      console.log(`[Postprocess] NMS後 検出数: ${filteredDetections.length}`);
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
