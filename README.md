# NDLKotenOCR-Lite Worker

**Web Worker を使用した NDL 古典籍 OCR のブラウザライブラリ**

NDL（国立国会図書館）古典籍 OCR を Web Worker として実装したライブラリです。バックグラウンドで OCR 処理を実行し、メイン UI をブロックしません。

## インストール

```bash
npm install ndlkotenocr-lite-worker
```

## 基本的な使用方法

### 方法 1: getWorkerUrl() を使用した直接的な WebWorker 利用

```javascript
import { getWorkerUrl } from 'ndlkotenocr-lite-worker';

// WebWorkerを作成
const worker = new Worker(getWorkerUrl(), {
  type: 'module',
});

// OCR処理の実行
const processImage = async (imageFile) => {
  // 画像をImageDataに変換
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();

  return new Promise((resolve, reject) => {
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

      // OCR処理開始
      worker.postMessage({
        type: 'OCR_PROCESS',
        id: Date.now().toString(),
        imageData: imageData,
        config: {
          outputFormats: ['txt', 'json', 'xml'],
        },
      });
    };

    // 結果受信
    worker.onmessage = (event) => {
      const { type, ...data } = event.data;

      switch (type) {
        case 'OCR_PROGRESS':
          console.log(
            `進捗: ${Math.round(data.progress * 100)}% - ${
              data.message
            }`
          );
          break;

        case 'OCR_COMPLETE':
          console.log('OCR完了:', data);
          resolve(data);
          break;

        case 'OCR_ERROR':
          reject(new Error(data.error));
          break;
      }
    };

    img.src = URL.createObjectURL(imageFile);
  });
};

// 初期化
worker.postMessage({ type: 'INITIALIZE' });
```

### 方法 2: 高レベル API クラスを使用（推奨）

```javascript
import NDLKotenOCR from 'ndlkotenocr-lite-worker';

const ocr = new NDLKotenOCR();

// OCR処理の実行
const processImage = async (imageFile) => {
  try {
    const result = await ocr.processImage(imageFile, {
      outputFormats: ['txt', 'json', 'xml'],
      onProgress: (progress) => {
        console.log(
          `進捗: ${Math.round(
            progress.progress * 100
          )}% - ${progress.message}`
        );
      },
    });

    console.log('テキスト結果:', result.txt);
    console.log('JSON結果:', result.json);
    console.log('XML結果:', result.xml);

    return result;
  } catch (error) {
    console.error('OCR処理エラー:', error);
  }
};

// 使用後はリソースを解放
// ocr.terminate();
```

### 方法 3: 既存のヘルパー関数を使用

```javascript
import {
  workerMessageHandler,
  FileHandler,
  ResultDisplay,
} from 'ndlkotenocr-lite-worker';

// Worker初期化
await workerMessageHandler.initializeWorker();

// ファイルハンドラーと結果表示の初期化
const fileHandler = new FileHandler();
const resultDisplay = new ResultDisplay();

// OCR処理
const result = await workerMessageHandler.processOCR(
  imageData,
  {
    outputFormats: ['txt', 'json', 'xml'],
  }
);

// 結果表示
resultDisplay.displayResults(result);
```

## API リファレンス

### getWorkerUrl()

WebWorker の URL を取得する関数です。

```javascript
import { getWorkerUrl } from 'ndlkotenocr-lite-worker';

const workerUrl = getWorkerUrl();
const worker = new Worker(workerUrl, { type: 'module' });
```

### NDLKotenOCR クラス

高レベルな OCR 処理 API を提供するクラスです。

#### コンストラクタ

```javascript
const ocr = new NDLKotenOCR();
```

#### メソッド

**`initialize()`**: WebWorker を初期化

```javascript
await ocr.initialize();
```

**`processImage(imageInput, options)`**: OCR 処理を実行

- `imageInput`: ImageData、HTMLImageElement、または File オブジェクト
- `options`: 処理オプション
  - `outputFormats`: 出力形式の配列 `['txt', 'json', 'xml']`
  - `onProgress`: 進捗コールバック関数

```javascript
const result = await ocr.processImage(file, {
  outputFormats: ['txt', 'json'],
  onProgress: (progress) => console.log(progress),
});
```

**`terminate()`**: WebWorker を終了

```javascript
ocr.terminate();
```

## WebWorker メッセージ API

### 送信メッセージ

**初期化**

```javascript
worker.postMessage({ type: 'INITIALIZE' });
```

**OCR 処理**

```javascript
worker.postMessage({
  type: 'OCR_PROCESS',
  id: 'unique-id',
  imageData: imageData,
  config: {
    outputFormats: ['txt', 'json', 'xml'],
  },
});
```

### 受信メッセージ

**進捗通知**

```javascript
{
  type: 'OCR_PROGRESS',
  id: 'unique-id',
  stage: 'layout_detection',
  progress: 0.5,
  message: 'レイアウト検出中...'
}
```

**完了通知**

```javascript
{
  type: 'OCR_COMPLETE',
  id: 'unique-id',
  txt: 'OCR結果テキスト',
  json: { /* JSON結果 */ },
  xml: '<xml>XML結果</xml>',
  textBlocks: [ /* 構造化データ */ ]
}
```

**エラー通知**

```javascript
{
  type: 'OCR_ERROR',
  id: 'unique-id',
  error: 'エラーメッセージ',
  stage: 'layout_detection'
}
```

## 設定とカスタマイズ

### モデルファイルの設定

OCR 処理に使用するモデルの URL は設定ファイルで変更できます。
プロジェクトに `config/ndl.yaml` ファイルを配置してください。

```yaml
# config/ndl.yaml
models:
  # レイアウト検出モデル
  layout: 'https://honkoku.org/models/rtmdet-s-1280x1280.onnx'

  # 文字認識モデル
  recognition: 'https://honkoku.org/models/parseq-ndl-32x384-tiny-10.onnx'
```

### デフォルト設定

設定ファイルが存在しない場合、以下のデフォルト URL が使用されます：

- **レイアウト検出**: `https://honkoku.org/models/rtmdet-s-1280x1280.onnx`
- **文字認識**: `https://honkoku.org/models/parseq-ndl-32x384-tiny-10.onnx`

### モデルサイズとキャッシュ

- **レイアウト検出モデル**: 約 80MB
- **テキスト認識モデル**: 約 30MB
- **合計**: 約 110MB

モデルは初回ダウンロード時に IndexedDB にキャッシュされ、2 回目以降は高速に読み込まれます。

## Vue.js での使用例

```vue
<template>
  <div>
    <input
      type="file"
      @change="handleFileSelect"
      accept="image/*"
    />
    <div v-if="processing">
      進捗: {{ Math.round(progress * 100) }}% -
      {{ progressMessage }}
    </div>
    <div v-if="result">
      <h3>OCR結果</h3>
      <pre>{{ result.txt }}</pre>
    </div>
  </div>
</template>

<script>
import NDLKotenOCR from 'ndlkotenocr-lite-worker';

export default {
  data() {
    return {
      ocr: new NDLKotenOCR(),
      processing: false,
      progress: 0,
      progressMessage: '',
      result: null,
    };
  },
  methods: {
    async handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;

      this.processing = true;
      this.result = null;

      try {
        this.result = await this.ocr.processImage(file, {
          outputFormats: ['txt', 'json'],
          onProgress: (progress) => {
            this.progress = progress.progress;
            this.progressMessage = progress.message;
          },
        });
      } catch (error) {
        console.error('OCR処理エラー:', error);
      } finally {
        this.processing = false;
      }
    },
  },
  beforeUnmount() {
    this.ocr.terminate();
  },
};
</script>
```

## React での使用例

```jsx
import React, { useState, useRef, useEffect } from 'react';
import NDLKotenOCR from 'ndlkotenocr-lite-worker';

function OCRComponent() {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] =
    useState('');
  const [result, setResult] = useState(null);
  const ocrRef = useRef(new NDLKotenOCR());

  useEffect(() => {
    return () => {
      ocrRef.current.terminate();
    };
  }, []);

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setProcessing(true);
    setResult(null);

    try {
      const ocrResult = await ocrRef.current.processImage(
        file,
        {
          outputFormats: ['txt', 'json'],
          onProgress: (progress) => {
            setProgress(progress.progress);
            setProgressMessage(progress.message);
          },
        }
      );
      setResult(ocrResult);
    } catch (error) {
      console.error('OCR処理エラー:', error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <input
        type='file'
        onChange={handleFileSelect}
        accept='image/*'
      />
      {processing && (
        <div>
          進捗: {Math.round(progress * 100)}% -{' '}
          {progressMessage}
        </div>
      )}
      {result && (
        <div>
          <h3>OCR結果</h3>
          <pre>{result.txt}</pre>
        </div>
      )}
    </div>
  );
}

export default OCRComponent;
```

## 特徴

- **Web Worker 対応**: OCR 処理をバックグラウンドで実行
- **モデルキャッシュ**: IndexedDB を使用して ONNX モデルをローカルキャッシュ
- **古典籍対応**: 縦書き・右から左の読み順に対応
- **複数出力形式**: テキスト、JSON、XML 形式での結果出力
- **リアルタイム進捗**: 処理進捗をリアルタイムで表示
- **TypeScript 対応**: 型定義ファイルを提供（予定）

## 技術スタック

- **ONNX Runtime Web**: モデル推論エンジン
- **Web Workers**: バックグラウンド処理
- **IndexedDB**: モデルキャッシュ
- **Canvas API**: 画像処理

## 対応ファイル形式

- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- BMP (.bmp)

最大ファイルサイズ: 50MB

## ブラウザ対応

- Chrome 80+
- Firefox 72+
- Safari 13.1+
- Edge 80+

Web Workers、WebAssembly、IndexedDB をサポートするモダンブラウザが必要です。

## トラブルシューティング

### モデルダウンロードが失敗する

- ネットワーク接続を確認
- 設定ファイル内のモデル URL が正しいことを確認
- CORS の設定を確認（外部サーバーからダウンロードする場合）

### OCR 処理が開始されない

- Web Worker がサポートされているか確認
- WebAssembly がサポートされているか確認
- ブラウザのコンソールでエラーを確認

### 認識精度が低い

- 画像の解像度を上げる
- 画像のコントラストを調整
- ノイズを除去

## 開発

このライブラリを開発・カスタマイズする場合：

```bash
git clone https://github.com/yuta1984/ndlkotenocr-lite-worker.git
cd ndlkotenocr-lite-worker
npm install
npm run dev
```

## ライセンス

CC-BY-4.0

## 謝辞

このプロジェクトは国立国会図書館の [ndlkotenocr-lite](https://github.com/ndl-lab/ndlkotenocr-lite) を基にしています。
