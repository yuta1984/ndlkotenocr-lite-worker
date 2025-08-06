/**
 * 設定ファイル（YAML）の読み込み・管理モジュール
 */

import yaml from 'js-yaml';

// 設定キャッシュ
let configCache = null;

/**
 * YAMLファイルを読み込み
 */
async function loadYamlFile(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to load config file: ${response.status} ${response.statusText}`
      );
    }

    const yamlText = await response.text();
    return yaml.load(yamlText);
  } catch (error) {
    console.error('Error loading YAML config:', error);
    throw error;
  }
}

/**
 * 設定を読み込み（キャッシュ機能付き）
 */
export async function loadConfig() {
  if (configCache) {
    return configCache;
  }

  try {
    // ndl.yamlファイルを読み込み
    const config = await loadYamlFile('/config/ndl.yaml');

    // デフォルト設定をマージ
    const defaultConfig = getDefaultConfig();
    configCache = mergeConfig(defaultConfig, config);

    console.log(
      'Configuration loaded successfully:',
      configCache
    );
    return configCache;
  } catch (error) {
    console.warn(
      'Failed to load config file, using defaults:',
      error.message
    );

    // 設定ファイルの読み込みに失敗した場合はデフォルト設定を使用
    configCache = getDefaultConfig();
    return configCache;
  }
}

/**
 * デフォルト設定を取得
 */
function getDefaultConfig() {
  return {
    models: {
      layout:
        'https://honkoku.org/models/rtmdet-s-1280x1280.onnx',
      recognition:
        'https://honkoku.org/models/parseq-ndl-32x384-tiny-10.onnx',
    },
    layout_detection: {
      score_threshold: 0.3,
      nms_threshold: 0.4,
      max_detections: 100,
      input_shape: [1, 3, 1024, 1024],
    },
    text_recognition: {
      input_shape: [1, 3, 32, 384],
      max_length: 25,
    },
    reading_order: {
      vertical_mode: true,
    },
    output_generation: {
      xml: {
        include_confidence: true,
        pretty_print: true,
        encoding: 'UTF-8',
      },
      json: {
        include_confidence: true,
        pretty_print: true,
        include_metadata: true,
      },
      txt: {
        separator: '\n',
        include_bounding_box: false,
      },
    },
  };
}

/**
 * 設定をマージ（深いマージ）
 */
function mergeConfig(defaultConfig, userConfig) {
  const merged = JSON.parse(JSON.stringify(defaultConfig));

  function deepMerge(target, source) {
    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  deepMerge(merged, userConfig);
  return merged;
}

/**
 * モデルURL一覧を取得
 */
export async function getModelUrls() {
  const config = await loadConfig();
  return config.models;
}

/**
 * 特定のモデルURLを取得
 */
export async function getModelUrl(modelType) {
  const modelUrls = await getModelUrls();

  if (!modelUrls[modelType]) {
    throw new Error(`Unknown model type: ${modelType}`);
  }

  return modelUrls[modelType];
}

/**
 * レイアウト検出設定を取得
 */
export async function getLayoutDetectionConfig() {
  const config = await loadConfig();
  return config.layout_detection;
}

/**
 * 文字認識設定を取得
 */
export async function getTextRecognitionConfig() {
  const config = await loadConfig();
  return config.text_recognition;
}

/**
 * 読み順処理設定を取得
 */
export async function getReadingOrderConfig() {
  const config = await loadConfig();
  return config.reading_order;
}

/**
 * 出力生成設定を取得
 */
export async function getOutputGenerationConfig() {
  const config = await loadConfig();
  return config.output_generation;
}

/**
 * 設定キャッシュをクリア
 */
export function clearConfigCache() {
  configCache = null;
}

/**
 * 設定を再読み込み
 */
export async function reloadConfig() {
  clearConfigCache();
  return await loadConfig();
}
