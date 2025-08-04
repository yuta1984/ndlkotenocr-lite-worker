# NDLKotenOCR-Lite Worker

## プログラムの概要

https://github.com/yuta1984/ndlkotenocr-lite-web
NDLKotenOCR Web 版 を Web Worker に対応させ、OCR 処理をバックグラウンドで実行可能にさせるものです。

## 指示

次の注意事項を守って、実装計画を TODO 項目をつけて markdown 形式で作成してください。

- 実装言語は JavaScript
- WebWorker とそのテストを優先して構築すること
- テストは HTML から実行できるものとする
- バンドラには vite を使うこと
- ビルドターゲットは esm とする
- モデルはそれぞれ次の URL からダウンロードする
  - https://github.com/yuta1984/ndlkotenocr-lite-web/raw/refs/heads/main/models/parseq-ndl-32x384-tiny-10.onnx
  - https://github.com/yuta1984/ndlkotenocr-lite-web/raw/refs/heads/main/models/rtmdet-s-1280x1280.onnx
