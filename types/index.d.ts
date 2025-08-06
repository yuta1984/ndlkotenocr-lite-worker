/**
 * NDLKotenOCR-Lite Worker Type Definitions
 */

// WebWorker URL取得関数
export function getWorkerUrl(): URL;

// OCR処理結果の型定義
export interface OCRResult {
  txt: string;
  json?: any;
  xml?: string;
  textBlocks: Array<{
    text: string;
    bbox: [number, number, number, number];
    confidence: number;
  }>;
}

// OCR処理オプションの型定義
export interface OCROptions {
  outputFormats?: Array<'txt' | 'json' | 'xml'>;
  onProgress?: (progress: {
    stage: string;
    progress: number;
    message: string;
  }) => void;
}

// 進捗情報の型定義
export interface ProgressData {
  stage:
    | 'initializing'
    | 'layout_detection'
    | 'text_recognition'
    | 'reading_order'
    | 'generating_output';
  progress: number;
  message: string;
}

// WebWorkerメッセージの型定義
export interface WorkerMessage {
  type: 'INITIALIZE' | 'OCR_PROCESS' | 'TERMINATE';
  id?: string;
  imageData?: ImageData;
  config?: {
    outputFormats: Array<'txt' | 'json' | 'xml'>;
    [key: string]: any;
  };
}

export interface WorkerResponse {
  type:
    | 'WORKER_READY'
    | 'OCR_PROGRESS'
    | 'OCR_COMPLETE'
    | 'OCR_ERROR';
  id?: string;
  stage?: string;
  progress?: number;
  message?: string;
  error?: string;
  txt?: string;
  json?: any;
  xml?: string;
  textBlocks?: Array<{
    text: string;
    bbox: [number, number, number, number];
    confidence: number;
  }>;
}

// NDLKotenOCRクラス
export class NDLKotenOCR {
  constructor();

  /**
   * WebWorkerを初期化
   */
  initialize(): Promise<void>;

  /**
   * OCR処理を実行
   * @param imageInput - 画像データ
   * @param options - 処理オプション
   */
  processImage(
    imageInput: ImageData | HTMLImageElement | File,
    options?: OCROptions
  ): Promise<OCRResult>;

  /**
   * WebWorkerを終了
   */
  terminate(): void;
}

export default NDLKotenOCR;

// ユーティリティ関数
export interface Config {
  models: {
    layout: string;
    recognition: string;
  };
  layout_detection: any;
  text_recognition: any;
  reading_order: any;
  output_generation: any;
}

export function loadModel(
  modelType: 'layout' | 'recognition',
  onProgress?: (progress: number) => void
): Promise<ArrayBuffer>;

export function preloadAllModels(
  onProgress?: (progress: number) => void
): Promise<void>;

export function getCachedModels(): Promise<string[]>;

export function clearCache(): Promise<void>;

export function loadConfig(): Promise<Config>;

export function getModelUrls(): Promise<{
  [key: string]: string;
}>;

export function getModelUrl(
  modelType: string
): Promise<string>;

// 高レベルAPI（既存）
export interface WorkerMessageHandler {
  initializeWorker(): Promise<void>;
  processOCR(
    imageData: ImageData,
    options?: any
  ): Promise<OCRResult>;
  on(event: string, callback: (data: any) => void): void;
}

export const workerMessageHandler: WorkerMessageHandler;

export class FileHandler {
  constructor();
  on(event: string, callback: (data: any) => void): void;
}

export class ResultDisplay {
  constructor();
  displayResults(result: OCRResult): void;
  downloadResult(format: 'txt' | 'json' | 'xml'): void;
}
