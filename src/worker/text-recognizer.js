/**
 * 文字認識モジュール
 * PARSeq-NDLモデルを使用してテキスト領域内の文字を認識
 */

import * as ort from "onnxruntime-web";

export class TextRecognizer {
  constructor() {
    this.session = null;
    this.inputSize = { width: 384, height: 32 };
    this.initialized = false;
    this.vocabulary = this.createVocabulary();
  }

  /**
   * 語彙の作成（NDL古典籍文字セット）
   */
  createVocabulary() {
    // NDL古典籍OCRの文字セット（簡略版）
    // 実際の実装では、より完全な古典籍文字セットが必要
    const chars = [
      "<blank>",
      "<unk>",
      "<s>",
      "</s>",
      "あ",
      "い",
      "う",
      "え",
      "お",
      "か",
      "き",
      "く",
      "け",
      "こ",
      "が",
      "ぎ",
      "ぐ",
      "げ",
      "ご",
      "さ",
      "し",
      "す",
      "せ",
      "そ",
      "ざ",
      "じ",
      "ず",
      "ぜ",
      "ぞ",
      "た",
      "ち",
      "つ",
      "て",
      "と",
      "だ",
      "ぢ",
      "づ",
      "で",
      "ど",
      "な",
      "に",
      "ぬ",
      "ね",
      "の",
      "は",
      "ひ",
      "ふ",
      "へ",
      "ほ",
      "ば",
      "び",
      "ぶ",
      "べ",
      "ぼ",
      "ぱ",
      "ぴ",
      "ぷ",
      "ぺ",
      "ぽ",
      "ま",
      "み",
      "む",
      "め",
      "も",
      "や",
      "ゆ",
      "よ",
      "ら",
      "り",
      "る",
      "れ",
      "ろ",
      "わ",
      "ゐ",
      "ゑ",
      "を",
      "ん",
      "ー",
      "々",
      "〆",
      "〇",
      "一",
      "二",
      "三",
      "四",
      "五",
      "六",
      "七",
      "八",
      "九",
      "十",
      "百",
      "千",
      "万",
      "上",
      "下",
      "中",
      "大",
      "小",
      "人",
      "今",
      "日",
      "月",
      "年",
      "出",
      "来",
      "行",
      "見",
      "聞",
      "言",
      "話",
      "書",
      "読",
      "学",
      "国",
      "家",
      "天",
      "地",
      "山",
      "川",
      "海",
      "火",
      "水",
      "木",
      "金",
      "土",
      "男",
      "女",
      "子",
      "父",
      "母",
      "兄",
      "弟",
      "姉",
      "妹",
      "友",
      "先",
      "生",
      "車",
      "電",
      "気",
      "店",
      "町",
      "村",
      "市",
      "県",
      "東",
      "西",
      "南",
      "北",
      "右",
      "左",
      "前",
      "後",
      "内",
      "外",
      "近",
      "遠",
      "高",
      "低",
      "長",
      "短",
      "新",
      "古",
      "白",
      "黒",
      "赤",
      "青",
      "黄",
      "緑",
      "明",
      "暗",
      "早",
      "遅",
      "多",
      "少",
      "良",
      "悪",
      "美",
      "醜",
      "強",
      "弱",
      "太",
      "細",
    ];

    const vocab = {};
    chars.forEach((char, index) => {
      vocab[index] = char;
    });

    return vocab;
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
      console.log("Text recognizer initialized successfully");
    } catch (error) {
      console.error("Failed to initialize text recognizer:", error);
      throw error;
    }
  }

  /**
   * テキスト領域から文字を認識
   */
  async recognize(imageData, region) {
    if (!this.initialized) {
      throw new Error("Text recognizer not initialized");
    }

    try {
      // 1. 領域を切り出し
      const croppedImageData = this.cropRegion(imageData, region);

      // 2. 前処理
      const inputTensor = await this.preprocessImage(croppedImageData);

      // 3. 推論実行
      const output = await this.runInference(inputTensor);

      // 4. 後処理（テキストデコード）
      const result = this.decodeOutput(output);

      return result;
    } catch (error) {
      console.error("Text recognition failed:", error);
      return {
        text: "",
        confidence: 0.0,
        error: error.message,
      };
    }
  }

  /**
   * 画像から指定領域を切り出し
   */
  cropRegion(imageData, region) {
    const canvas = new OffscreenCanvas(region.width, region.height);
    const ctx = canvas.getContext("2d");

    // 元の画像をキャンバスに描画
    const sourceCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    const sourceCtx = sourceCanvas.getContext("2d");
    sourceCtx.putImageData(imageData, 0, 0);

    // 指定領域を切り出し
    ctx.drawImage(
      sourceCanvas,
      region.x,
      region.y,
      region.width,
      region.height,
      0,
      0,
      region.width,
      region.height
    );

    return ctx.getImageData(0, 0, region.width, region.height);
  }

  /**
   * 画像の前処理
   */
  async preprocessImage(imageData) {
    return new Promise((resolve, reject) => {
      try {
        const canvas = new OffscreenCanvas(
          this.inputSize.width,
          this.inputSize.height
        );
        const ctx = canvas.getContext("2d");

        // 元画像をキャンバスに復元
        const sourceCanvas = new OffscreenCanvas(
          imageData.width,
          imageData.height
        );
        const sourceCtx = sourceCanvas.getContext("2d");
        sourceCtx.putImageData(imageData, 0, 0);

        // アスペクト比を保持してリサイズ
        const scaleX = this.inputSize.width / imageData.width;
        const scaleY = this.inputSize.height / imageData.height;
        const scale = Math.min(scaleX, scaleY);

        const newWidth = Math.round(imageData.width * scale);
        const newHeight = Math.round(imageData.height * scale);

        // 背景を白で塗りつぶし
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, this.inputSize.width, this.inputSize.height);

        // 中央に配置
        const offsetX = (this.inputSize.width - newWidth) / 2;
        const offsetY = (this.inputSize.height - newHeight) / 2;

        ctx.drawImage(sourceCanvas, offsetX, offsetY, newWidth, newHeight);

        // ImageDataを取得
        const resizedImageData = ctx.getImageData(
          0,
          0,
          this.inputSize.width,
          this.inputSize.height
        );

        // グレースケール化して正規化 [1, 1, H, W]
        const tensor = new Float32Array(
          1 * 1 * this.inputSize.height * this.inputSize.width
        );
        const { data } = resizedImageData;

        for (let i = 0; i < this.inputSize.height * this.inputSize.width; i++) {
          // RGBをグレースケールに変換して正規化 (0-255 -> 0-1)
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];
          const gray = (r * 0.299 + g * 0.587 + b * 0.114) / 255.0;
          tensor[i] = gray;
        }

        const inputTensor = new ort.Tensor("float32", tensor, [
          1,
          1,
          this.inputSize.height,
          this.inputSize.width,
        ]);

        resolve(inputTensor);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 推論実行
   */
  async runInference(inputTensor) {
    // PARSeqモデルの入力名は通常 'images' または 'input'
    const feeds = { images: inputTensor };
    const results = await this.session.run(feeds);
    return results;
  }

  /**
   * 出力のデコード
   */
  decodeOutput(output) {
    try {
      // PARSeqの出力形式に応じて処理
      const outputKeys = Object.keys(output);
      const logits = output[outputKeys[0]]; // 最初の出力テンソル

      const outputData = logits.data;
      const seqLength = logits.dims[1]; // シーケンス長
      const vocabSize = logits.dims[2]; // 語彙サイズ

      // 各位置で最も確率の高い文字を選択
      const predictedIds = [];
      const confidences = [];

      for (let i = 0; i < seqLength; i++) {
        let maxProb = -Infinity;
        let maxIndex = 0;

        for (let j = 0; j < vocabSize; j++) {
          const prob = outputData[i * vocabSize + j];
          if (prob > maxProb) {
            maxProb = prob;
            maxIndex = j;
          }
        }

        predictedIds.push(maxIndex);
        confidences.push(this.softmax(maxProb));
      }

      // IDを文字に変換
      const text = this.idsToText(predictedIds);
      const confidence =
        confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;

      return {
        text: text.trim(),
        confidence: Math.min(Math.max(confidence, 0.0), 1.0),
        rawPredictions: predictedIds,
      };
    } catch (error) {
      console.error("Error decoding output:", error);
      return {
        text: "",
        confidence: 0.0,
        error: error.message,
      };
    }
  }

  /**
   * IDを文字列に変換
   */
  idsToText(ids) {
    let text = "";
    let previousId = null;

    for (const id of ids) {
      // 特殊トークンをスキップ
      if (id === 0 || id === 1) continue; // <blank>, <unk>
      if (id === 2) break; // <s> (開始トークン)
      if (id === 3) break; // </s> (終了トークン)

      // 同じ文字の連続を避ける（CTC的な処理）
      if (id !== previousId && this.vocabulary[id]) {
        text += this.vocabulary[id];
      }
      previousId = id;
    }

    return text;
  }

  /**
   * ソフトマックス関数（簡易版）
   */
  softmax(x) {
    const exp = Math.exp(x);
    return exp / (exp + 1); // 二値分類的簡略化
  }

  /**
   * バッチ処理で複数領域を認識
   */
  async recognizeBatch(imageData, regions) {
    const results = [];

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      const result = await this.recognize(imageData, region);
      results.push({
        ...region,
        text: result,
      });
    }

    return results;
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
