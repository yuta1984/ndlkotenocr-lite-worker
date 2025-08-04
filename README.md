# NDLKotenOCR-Lite Worker

Web Worker を使用した NDL 古典籍 OCR のブラウザ実装。バックグラウンドで OCR 処理を実行し、メイン UI をブロックしません。

## 特徴

- **Web Worker 対応**: OCR 処理をバックグラウンドで実行
- **モデルキャッシュ**: IndexedDB を使用して ONNX モデルをローカルキャッシュ
- **古典籍対応**: 縦書き・右から左の読み順に対応
- **複数出力形式**: テキスト、JSON、XML 形式での結果出力
- **リアルタイム進捗**: 処理進捗をリアルタイムで表示
- **ドラッグ&ドロップ**: 直感的なファイル選択

## 技術スタック

- **Vite**: モジュールバンドラー（ESM ターゲット）
- **ONNX Runtime Web**: モデル推論エンジン
- **Web Workers**: バックグラウンド処理
- **IndexedDB**: モデルキャッシュ
- **Canvas API**: 画像処理

## 使用モデル

- **レイアウト検出**: rtmdet-s-1280x1280.onnx
- **文字認識**: parseq-ndl-32x384-tiny-10.onnx

モデルは初回実行時に自動ダウンロードされ、IndexedDB にキャッシュされます。

## インストール

```bash
npm install
```

## 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173/test/` にアクセスしてテストページを表示します。

## ビルド

```bash
npm run build
```

## プロジェクト構造

```
ndlkotenocr-worker/
├── src/
│   ├── main.js                 # メインエントリーポイント
│   ├── worker/
│   │   ├── ocr-worker.js      # Web Worker本体
│   │   ├── layout-detector.js  # レイアウト検出
│   │   ├── text-recognizer.js  # 文字認識
│   │   └── reading-order.js    # 読み順処理
│   ├── utils/
│   │   ├── model-loader.js     # モデル管理
│   │   └── message-handler.js  # Worker通信
│   └── ui/
│       ├── file-handler.js     # ファイル操作
│       └── result-display.js   # 結果表示
├── test/
│   └── index.html             # テストページ
├── vite.config.js
└── package.json
```

## 使用方法

### 基本的な使用方法

1. テストページ（`test/index.html`）を開く
2. 「モデル事前ダウンロード」で必要なモデルをダウンロード（初回のみ）
3. 画像ファイルをドラッグ&ドロップまたは選択
4. 設定（読み方向、出力形式など）を調整
5. 「OCR 実行」ボタンで OCR 処理を開始
6. 結果を確認・ダウンロード

### プログラムから使用

```javascript
import { app } from "./src/main.js";

// アプリケーションの初期化
await app.initialize();

// ファイル処理
const file = // File オブジェクト
  await app.processFile(file);
```

### Web Worker 直接使用

```javascript
import { workerMessageHandler } from "./src/utils/message-handler.js";

// Worker初期化
await workerMessageHandler.initializeWorker();

// OCR処理
const result = await workerMessageHandler.processOCR(imageData, config);
```

## 設定オプション

### 読み方向

- `vertical`: 縦書き（デフォルト）
- `horizontal`: 横書き

### 列方向

- `right-to-left`: 右から左（古典籍用、デフォルト）
- `left-to-right`: 左から右

### 出力形式

- `txt`: プレーンテキスト
- `json`: JSON 形式（構造化データ）
- `xml`: XML 形式（位置情報付き）

## API

### WorkerMessageHandler

```javascript
// Worker初期化
await workerMessageHandler.initializeWorker();

// OCR処理
const result = await workerMessageHandler.processOCR(imageData, {
  outputFormats: ["txt", "json", "xml"],
  readingOrder: {
    direction: "vertical",
    columnDirection: "right-to-left",
  },
});

// 進捗監視
workerMessageHandler.on("progress", (data) => {
  console.log(`Progress: ${data.progress * 100}%`);
});
```

### FileHandler

```javascript
const fileHandler = new FileHandler();

// ファイル選択イベント
fileHandler.on("fileSelected", (file) => {
  console.log("File selected:", file.name);
});
```

### ResultDisplay

```javascript
const resultDisplay = new ResultDisplay();

// 結果表示
resultDisplay.displayResults(ocrResult);

// 結果ダウンロード
resultDisplay.downloadResult("txt");
```

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

## 開発

### 新機能の追加

1. `src/worker/` に新しい処理モジュールを追加
2. `src/worker/ocr-worker.js` で統合
3. `src/main.js` で UI 側の処理を追加

### カスタムモデルの使用

`src/utils/model-loader.js` の `MODEL_URLS` を変更してカスタムモデルを使用できます。

### UI のカスタマイズ

`test/index.html` の CSS を編集するか、独自の HTML ページを作成してください。

## トラブルシューティング

### モデルダウンロードが失敗する

- ネットワーク接続を確認
- ブラウザのセキュリティ設定を確認
- CORS の設定を確認

### OCR 処理が開始されない

- Web Worker がサポートされているか確認
- WebAssembly がサポートされているか確認
- ブラウザのコンソールでエラーを確認

### 認識精度が低い

- 画像の解像度を上げる
- 画像のコントラストを調整
- ノイズを除去

## ライセンス

CC-BY-4.0

## 謝辞

このプロジェクトは国立国会図書館の [ndlkotenocr-lite](https://github.com/ndl-lab/ndlkotenocr-lite) を基にしています。
