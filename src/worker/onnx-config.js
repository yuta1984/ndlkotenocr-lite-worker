/**
 * ONNX Runtime Web の設定ファイル
 * Web Worker内での統一設定
 */

import * as ort from 'onnxruntime-web';

// ONNX Runtime Web の初期設定
function initializeONNX() {
  // WASM ファイルのパス設定
  ort.env.wasm.wasmPaths =
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/';

  // Web Worker用の設定（より安全な設定）
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = false; // SIMDを無効化してより安定した動作を確保
  ort.env.logLevel = 'warning';

  // プロキシワーカーを無効化（Web Worker内では不要）
  ort.env.wasm.proxy = false;

  // より基本的なWASMファイルを使用
  ort.env.wasm.wasmPaths = {
    'ort-wasm.wasm':
      'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/ort-wasm.wasm',
    'ort-wasm-threaded.wasm':
      'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/ort-wasm.wasm',
  };

  console.log('ONNX Runtime Web configured for Web Worker');
}

/**
 * モデルセッションを作成（統一設定）
 */
export async function createSession(
  modelData,
  options = {}
) {
  try {
    const defaultOptions = {
      executionProviders: ['cpu'],
      logSeverityLevel: 4,
      graphOptimizationLevel: 'basic',
      enableCpuMemArena: false,
      enableMemPattern: false,
      ...options,
    };

    const session = await ort.InferenceSession.create(
      modelData,
      defaultOptions
    );
    return session;
  } catch (error) {
    console.error('Failed to create ONNX session:', error);
    throw error;
  }
}

// 初期化を実行
initializeONNX();

export { ort };
