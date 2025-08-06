# NDLKotenOCR-Lite Worker

**Web アプリケーションに組み込むことを目的とした WebWorker ライブラリ**

Web Worker を使用した NDL 古典籍 OCR のブラウザ実装。バックグラウンドで OCR 処理を実行し、メイン UI をブロックしません。

> **注意**: `test/` ディレクトリ内のファイル（`test/index.html`、`test/main.js`等）はライブラリのテスト・動作確認用です。実際の Web アプリケーションに組み込む際は、`src/` ディレクトリ内のモジュールを直接インポートして使用してください。

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

モデルは初回実行時に以下の URL から自動ダウンロードされ、IndexedDB にキャッシュされます：

- **デフォルト URL**:
  - レイアウト検出: `https://honkoku.org/models/rtmdet-s-1280x1280.onnx`
  - 文字認識: `https://honkoku.org/models/parseq-ndl-32x384-tiny-10.onnx`

モデルの URL は `config/ndl.yaml` ファイルで設定できます。

## モデルのロードタイミング

NDLKotenOCR-Lite Worker では、モデルの効率的な管理とロードが行われます：

### 1. 自動ロード（デフォルト動作）

モデルは**OCR 処理が初めて実行される際に自動的にロード**されます：

- ユーザーが画像をアップロードして OCR 処理を開始
- Web Worker が未初期化の場合、`initialize()`メソッドが実行
- レイアウト検出モデルとテキスト認識モデルを順次ダウンロード
- 進捗表示付きでダウンロードを実行
- IndexedDB にキャッシュ後、OCR 処理を開始

### 2. 手動事前ロード（推奨）

**初回使用前に「モデル事前ダウンロード」ボタンを使用**することで：

- すべてのモデルを事前にダウンロード・キャッシュ
- 実際の OCR 処理時は即座に開始可能
- ネットワーク環境の良い時にまとめてダウンロードできる

### 3. キャッシュ機能

IndexedDB を使用したキャッシュシステムにより：

- **初回**：ネットワークからダウンロード（時間がかかる）
- **2 回目以降**：ローカルキャッシュから高速ロード（即座に開始）
- ブラウザを閉じてもキャッシュは保持される
- 必要に応じて「キャッシュクリア」で削除可能

### ロードの流れ

```
1. 画像アップロード
   ↓
2. OCRWorker.initialize() 実行判定
   ↓
3a. 初回またはキャッシュなし
   → ネットワークからダウンロード（進捗表示）
   → IndexedDBに保存
   ↓
3b. キャッシュあり
   → IndexedDBから高速ロード
   ↓
4. OCR処理開始
```

### モデルサイズ

- **レイアウト検出モデル**: 約 80MB
- **テキスト認識モデル**: 約 30MB
- **合計**: 約 110MB

初回ダウンロードには数分かかる場合があります。事前ダウンロードの使用を推奨します。

## 設定

### モデル URL の設定

`config/ndl.yaml` ファイルでモデルの URL を設定できます：

```yaml
# モデルファイル設定
models:
  # レイアウト検出モデル
  layout: 'https://your-server.com/models/rtmdet-s-1280x1280.onnx'

  # 文字認識モデル
  recognition: 'https://your-server.com/models/parseq-ndl-32x384-tiny-10.onnx'
```

### その他の設定

- **レイアウト検出**: スコア閾値、NMS 閾値、最大検出数等
- **文字認識**: 入力サイズ、最大文字列長等
- **読み順処理**: 縦書きモード設定等
- **出力生成**: XML、JSON、テキスト出力の詳細設定

詳細は `config/ndl.yaml` ファイルを参照してください。

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
├── src/                        # ライブラリ本体
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
├── test/                       # テスト用ファイル
│   ├── index.html             # テストページ
│   └── main.js                # テスト用エントリーポイント
├── vite.config.js
└── package.json
```

## 使用方法

### 基本的な使用方法

1. テストページ（`test/index.html`）を開く
2. 「モデル事前ダウンロード」で必要なモデルをダウンロード（初回のみ）
3. 画像ファイルをドラッグ&ドロップまたは選択
4. 設定（出力形式など）を調整
5. 「OCR 実行」ボタンで OCR 処理を開始
6. 結果を確認・ダウンロード

### プログラムから使用

WebWorker ライブラリとして、以下のように src/内のモジュールを直接インポートして使用します：

```javascript
import { workerMessageHandler } from './src/utils/message-handler.js';
import { FileHandler } from './src/ui/file-handler.js';
import { ResultDisplay } from './src/ui/result-display.js';

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

### Web Worker 直接使用

高度な使用方法として、Web Worker を直接呼び出して OCR 処理を実行できます。

#### 方法 1: WorkerMessageHandler を使用（推奨）

```javascript
import { workerMessageHandler } from './src/utils/message-handler.js';

// Worker初期化
await workerMessageHandler.initializeWorker();

// OCR処理
const result = await workerMessageHandler.processOCR(
  imageData,
  {
    outputFormats: ['txt', 'json', 'xml'],
  }
);

// 進捗監視
workerMessageHandler.on('progress', (progressData) => {
  console.log(
    `Stage: ${progressData.stage}, Progress: ${Math.round(
      progressData.progress * 100
    )}%`
  );
});
```

#### 方法 2: Web Worker を直接操作

```javascript
// Web Worker のインスタンス作成
const worker = new Worker('./src/worker/ocr-worker.js', {
  type: 'module',
});

// メッセージハンドラの設定
worker.onmessage = function (event) {
  const { type, ...data } = event.data;

  switch (type) {
    case 'OCR_PROGRESS':
      console.log(
        `Progress: ${Math.round(data.progress * 100)}% - ${
          data.message
        }`
      );
      break;

    case 'OCR_COMPLETE':
      console.log('OCR Complete:', data);
      // data.txt - テキスト結果
      // data.json - JSON結果（設定時）
      // data.xml - XML結果（設定時）
      // data.textBlocks - 構造化されたテキストブロック
      break;

    case 'OCR_ERROR':
      console.error('OCR Error:', data.error);
      break;
  }
};

// Worker の初期化
worker.postMessage({ type: 'INITIALIZE' });

// 画像データの準備
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const img = new Image();

img.onload = function () {
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  // OCR処理の実行
  worker.postMessage({
    type: 'OCR_PROCESS',
    id: 'unique-process-id',
    imageData: imageData,
    config: {
      outputFormats: ['txt', 'json', 'xml'],
    },
  });
};

img.src = 'path/to/your/image.jpg';

// Worker の終了
// worker.postMessage({ type: 'TERMINATE' });
```

#### メッセージタイプ詳細

**送信メッセージ:**

- `INITIALIZE`: Worker の初期化
- `OCR_PROCESS`: OCR 処理の実行
  - `id`: 処理 ID（任意の文字列）
  - `imageData`: ImageData オブジェクト
  - `config`: 設定オプション
- `TERMINATE`: Worker の終了

**受信メッセージ:**

- `OCR_PROGRESS`: 処理進捗
  - `stage`: 処理段階 (`initializing`, `layout_detection`, `text_recognition`, `reading_order`, `generating_output`)
  - `progress`: 進捗率 (0.0 - 1.0)
  - `message`: 進捗メッセージ
- `OCR_COMPLETE`: 処理完了
  - `textBlocks`: 構造化されたテキストブロック
  - `txt`: プレーンテキスト結果
  - `json`: JSON 結果（設定時）
  - `xml`: XML 結果（設定時）
- `OCR_ERROR`: エラー発生
  - `error`: エラーメッセージ
  - `stage`: エラー発生段階

#### 設定オプション

```javascript
const config = {
  outputFormats: ['txt', 'json', 'xml'], // 出力形式の配列
};
```

## 設定オプション

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
const result = await workerMessageHandler.processOCR(
  imageData,
  {
    outputFormats: ['txt', 'json', 'xml'],
  }
);

// 進捗監視
workerMessageHandler.on('progress', (data) => {
  console.log(`Progress: ${data.progress * 100}%`);
});
```

### FileHandler

```javascript
const fileHandler = new FileHandler();

// ファイル選択イベント
fileHandler.on('fileSelected', (file) => {
  console.log('File selected:', file.name);
});
```

### ResultDisplay

```javascript
const resultDisplay = new ResultDisplay();

// 結果表示
resultDisplay.displayResults(ocrResult);

// 結果ダウンロード
resultDisplay.downloadResult('txt');
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
3. 必要に応じて `src/utils/` や `src/ui/` のモジュールを更新

### カスタムモデルの使用

`config/ndl.yaml` ファイルでモデル URL を変更してカスタムモデルを使用できます：

```yaml
models:
  layout: 'https://your-server.com/path/to/custom-layout-model.onnx'
  recognition: 'https://your-server.com/path/to/custom-recognition-model.onnx'
```

設定変更後、ブラウザのキャッシュをクリアするか、開発者ツールで強制リロードすることを推奨します。

### UI のカスタマイズ

`test/index.html` の CSS を編集するか、独自の HTML ページを作成してください。

## トラブルシューティング

### 設定ファイル読み込みエラー

**エラー**: "Failed to load config file" または設定が反映されない

- `config/ndl.yaml` ファイルが存在することを確認
- YAML 記法が正しいことを確認（インデント、引用符など）
- 開発サーバーが `config/` ディレクトリを適切に配信していることを確認
- ブラウザの開発者ツールでネットワークタブを確認し、404 エラーがないか確認

### モデルダウンロードが失敗する

**エラー**: "HTTP error" または "Unknown model type"

- ネットワーク接続を確認
- `config/ndl.yaml` のモデル URL が正しいことを確認
- モデルファイルが指定された URL でアクセス可能かブラウザで直接確認
- CORS の設定を確認（外部サーバーからダウンロードする場合）
- ブラウザのセキュリティ設定を確認

### OCR 処理が開始されない

- Web Worker がサポートされているか確認
- WebAssembly がサポートされているか確認
- ブラウザのコンソールでエラーを確認
- モデルが正常にダウンロード・キャッシュされているか確認

### 認識精度が低い

- 画像の解像度を上げる
- 画像のコントラストを調整
- ノイズを除去
- 適切なモデルが設定されているか確認

## ライセンス

CC-BY-4.0

## 謝辞

このプロジェクトは国立国会図書館の [ndlkotenocr-lite](https://github.com/ndl-lab/ndlkotenocr-lite) を基にしています。
