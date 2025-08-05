/**
 * NDLKotenOCR Web Worker
 * OCR処理をバックグラウンドで実行
 */

import { loadModel } from '../utils/model-loader.js';
import { LayoutDetector } from './layout-detector.js';
import { TextRecognizer } from './text-recognizer.js';
import { ReadingOrderProcessor } from './reading-order.js';
import './onnx-config.js'; // ONNX Runtime Web の設定を読み込み

class OCRWorker {
  constructor() {
    this.layoutDetector = null;
    this.textRecognizer = null;
    this.readingOrderProcessor =
      new ReadingOrderProcessor();
    this.isInitialized = false;
  }

  /**
   * ワーカーの初期化
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      this.postMessage({
        type: 'OCR_PROGRESS',
        stage: 'initializing',
        progress: 0.1,
        message: 'Initializing OCR Worker...',
      });

      // モデルの読み込み
      const layoutModelData = await loadModel(
        'layout',
        (progress) => {
          this.postMessage({
            type: 'OCR_PROGRESS',
            stage: 'loading_layout_model',
            progress: 0.1 + progress * 0.4,
            message: `Loading layout detection model... ${Math.round(
              progress * 100
            )}%`,
          });
        }
      );

      const recognitionModelData = await loadModel(
        'recognition',
        (progress) => {
          this.postMessage({
            type: 'OCR_PROGRESS',
            stage: 'loading_recognition_model',
            progress: 0.5 + progress * 0.4,
            message: `Loading text recognition model... ${Math.round(
              progress * 100
            )}%`,
          });
        }
      );

      // 検出器とリコグナイザーの初期化
      this.layoutDetector = new LayoutDetector();
      await this.layoutDetector.initialize(layoutModelData);

      this.textRecognizer = new TextRecognizer();
      await this.textRecognizer.initialize(
        recognitionModelData
      );

      this.isInitialized = true;

      this.postMessage({
        type: 'OCR_PROGRESS',
        stage: 'initialized',
        progress: 1.0,
        message: 'OCR Worker initialized successfully',
      });
    } catch (error) {
      this.postMessage({
        type: 'OCR_ERROR',
        error: error.message,
        stage: 'initialization',
      });
    }
  }

  /**
   * OCR処理の実行
   */
  async processOCR(data) {
    const { id, imageData, config = {} } = data;

    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Stage 1: レイアウト検出
      this.postMessage({
        type: 'OCR_PROGRESS',
        id,
        stage: 'layout_detection',
        progress: 0.1,
        message: 'Detecting text regions...',
      });

      const textRegions = await this.layoutDetector.detect(
        imageData,
        (progress) => {
          this.postMessage({
            type: 'OCR_PROGRESS',
            id,
            stage: 'layout_detection',
            progress: 0.1 + progress * 0.3,
            message: `Detecting text regions... ${Math.round(
              progress * 100
            )}%`,
          });
        }
      );

      // Stage 2: 文字認識
      this.postMessage({
        type: 'OCR_PROGRESS',
        id,
        stage: 'text_recognition',
        progress: 0.4,
        message: `Recognizing text in ${textRegions.length} regions...`,
      });

      const recognitionResults = [];
      for (let i = 0; i < textRegions.length; i++) {
        const region = textRegions[i];
        const text = await this.textRecognizer.recognize(
          imageData,
          region
        );

        recognitionResults.push({
          ...region,
          text,
          confidence: text.confidence || 0.0,
        });

        this.postMessage({
          type: 'OCR_PROGRESS',
          id,
          stage: 'text_recognition',
          progress:
            0.4 + ((i + 1) / textRegions.length) * 0.4,
          message: `Recognized ${i + 1}/${
            textRegions.length
          } regions`,
        });
      }
      console.log('認識結果すべて:', recognitionResults);

      // Stage 3: 読み順処理
      this.postMessage({
        type: 'OCR_PROGRESS',
        id,
        stage: 'reading_order',
        progress: 0.8,
        message: 'Processing reading order...',
      });

      const orderedResults =
        this.readingOrderProcessor.process(
          recognitionResults
        );
      console.log('読み順処理後の結果:', orderedResults);

      // Stage 4: 結果の生成
      this.postMessage({
        type: 'OCR_PROGRESS',
        id,
        stage: 'generating_output',
        progress: 0.9,
        message: 'Generating output...',
      });

      const result = {
        textBlocks: orderedResults,
        totalRegions: textRegions.length,
        successfulRecognitions: recognitionResults.filter(
          (r) => r.text && r.text.text
        ).length,
        processingTime: Date.now() - data.startTime,
      };
      console.log('最終結果:', result);

      // 出力形式の生成
      if (config.outputFormats) {
        if (config.outputFormats.includes('xml')) {
          result.xml =
            this.generateXMLOutput(orderedResults);
        }
        if (config.outputFormats.includes('json')) {
          result.json =
            this.generateJSONOutput(orderedResults);
        }
        if (config.outputFormats.includes('txt')) {
          result.txt =
            this.generateTextOutput(orderedResults);
        }
      }

      this.postMessage({
        type: 'OCR_COMPLETE',
        id,
        result,
      });
    } catch (error) {
      this.postMessage({
        type: 'OCR_ERROR',
        id,
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * XML形式の出力生成
   */
  generateXMLOutput(textBlocks) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<document>\n';

    textBlocks.forEach((block, index) => {
      xml += `  <textblock id="${index}" x="${block.x}" y="${block.y}" width="${block.width}" height="${block.height}" confidence="${block.confidence}">\n`;
      xml += `    <text>${this.escapeXML(
        block.text?.text || ''
      )}</text>\n`;
      xml += '  </textblock>\n';
    });

    xml += '</document>';
    return xml;
  }

  /**
   * JSON形式の出力生成
   */
  generateJSONOutput(textBlocks) {
    return {
      document: {
        textBlocks: textBlocks.map((block, index) => ({
          id: index,
          x: block.x,
          y: block.y,
          width: block.width,
          height: block.height,
          confidence: block.confidence,
          text: block.text?.text || '',
        })),
      },
    };
  }

  /**
   * テキスト形式の出力生成
   */
  generateTextOutput(textBlocks) {
    return textBlocks
      .filter((block) => block.text?.text)
      .map((block) => block.text.text)
      .join('\n');
  }

  /**
   * XML エスケープ
   */
  escapeXML(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * メッセージの送信
   */
  postMessage(message) {
    self.postMessage(message);
  }
}

// ワーカーインスタンス
const ocrWorker = new OCRWorker();

// メインスレッドからのメッセージ処理
self.onmessage = async function (event) {
  const { type, ...data } = event.data;

  switch (type) {
    case 'INITIALIZE':
      await ocrWorker.initialize();
      break;

    case 'OCR_PROCESS':
      await ocrWorker.processOCR({
        ...data,
        startTime: Date.now(),
      });
      break;

    case 'TERMINATE':
      self.close();
      break;

    default:
      console.warn('Unknown message type:', type);
  }
};

// エラーハンドリング
self.onerror = function (error) {
  self.postMessage({
    type: 'OCR_ERROR',
    error: error.message,
    filename: error.filename,
    lineno: error.lineno,
  });
};
