/**
 * モデルファイルのダウンロード・キャッシュ管理モジュール
 */

import {
  getModelUrl,
  getModelUrls,
} from './config-loader.js';

const DB_NAME = 'NDLKotenOCRModels';
const DB_VERSION = 1;
const STORE_NAME = 'models';

/**
 * IndexedDBの初期化
 */
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: 'name',
        });
      }
    };
  });
}

/**
 * キャッシュからモデルを取得
 */
async function getModelFromCache(modelName) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [STORE_NAME],
      'readonly'
    );
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(modelName);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result?.data);
  });
}

/**
 * モデルをキャッシュに保存
 */
async function saveModelToCache(modelName, data) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [STORE_NAME],
      'readwrite'
    );
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ name: modelName, data });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * プログレス付きでファイルをダウンロード
 */
async function downloadWithProgress(url, onProgress) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `HTTP error! status: ${response.status}`
    );
  }

  const contentLength = parseInt(
    response.headers.get('content-length') || '0',
    10
  );
  let receivedLength = 0;

  const reader = response.body.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    chunks.push(value);
    receivedLength += value.length;

    if (onProgress && contentLength > 0) {
      onProgress(receivedLength / contentLength);
    }
  }

  const allChunks = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    allChunks.set(chunk, position);
    position += chunk.length;
  }

  return allChunks.buffer;
}

/**
 * モデルファイルを読み込み（キャッシュ優先）
 */
export async function loadModel(modelType, onProgress) {
  // 設定からモデルURLを取得
  let modelUrl;
  try {
    modelUrl = await getModelUrl(modelType);
  } catch (error) {
    throw new Error(`Unknown model type: ${modelType}`);
  }

  // キャッシュから確認
  const cachedModel = await getModelFromCache(modelType);
  if (cachedModel) {
    console.log(`Model ${modelType} loaded from cache`);
    if (onProgress) onProgress(1.0);
    return cachedModel;
  }

  // ダウンロード
  console.log(
    `Downloading model ${modelType} from ${modelUrl}`
  );
  const modelData = await downloadWithProgress(
    modelUrl,
    onProgress
  );

  // キャッシュに保存
  await saveModelToCache(modelType, modelData);
  console.log(`Model ${modelType} cached successfully`);

  return modelData;
}

/**
 * 全モデルの事前ダウンロード
 */
export async function preloadAllModels(onProgress) {
  // 設定からモデル一覧を取得（静的インポートを使用）
  const modelUrls = await getModelUrls();
  const modelTypes = Object.keys(modelUrls);
  const totalModels = modelTypes.length;
  let completedModels = 0;

  const updateProgress = (modelProgress) => {
    const totalProgress =
      (completedModels + modelProgress) / totalModels;
    if (onProgress) onProgress(totalProgress);
  };

  for (const modelType of modelTypes) {
    await loadModel(modelType, updateProgress);
    completedModels++;
  }
}

/**
 * キャッシュされたモデルの一覧を取得
 */
export async function getCachedModels() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [STORE_NAME],
      'readonly'
    );
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAllKeys();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * キャッシュをクリア
 */
export async function clearCache() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [STORE_NAME],
      'readwrite'
    );
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
