/**
 * 結果表示モジュール
 * OCR処理結果の表示とダウンロード機能を管理
 */

export class ResultDisplay {
  constructor() {
    this.currentResults = null;
    this.setupElements();
  }

  /**
   * DOM要素の設定
   */
  setupElements() {
    this.resultContainer = document.getElementById("result-container");
    this.resultTabs = document.getElementById("result-tabs");
    this.resultContent = document.getElementById("result-content");
    this.downloadSection = document.getElementById("download-section");

    this.setupTabHandlers();
    this.setupDownloadHandlers();
  }

  /**
   * タブハンドラーの設定
   */
  setupTabHandlers() {
    if (!this.resultTabs) return;

    this.resultTabs.addEventListener("click", (event) => {
      if (event.target.classList.contains("tab-button")) {
        const tabId = event.target.dataset.tab;
        this.switchTab(tabId);
      }
    });
  }

  /**
   * ダウンロードハンドラーの設定
   */
  setupDownloadHandlers() {
    const downloadButtons = document.querySelectorAll("[data-download]");
    downloadButtons.forEach((button) => {
      button.addEventListener("click", (event) => {
        const format = event.target.dataset.download;
        this.downloadResult(format);
      });
    });
  }

  /**
   * 結果の表示
   */
  displayResults(results) {
    console.log("Displaying OCR results:", results);

    this.currentResults = results;

    if (!this.resultContainer) {
      console.warn("Result container not found");
      return;
    }

    // 結果コンテナを表示
    this.resultContainer.classList.remove("hidden");

    // 統計情報の表示
    this.displayStatistics(results);

    // テキストブロックの表示
    this.displayTextBlocks(results.textBlocks || []);

    // 各形式での結果表示
    this.displayFormattedResults(results);

    // ダウンロードボタンの有効化
    this.enableDownloadButtons();

    // デフォルトタブを表示
    this.switchTab("text");
  }

  /**
   * 統計情報の表示
   */
  displayStatistics(results) {
    const statsElement = document.getElementById("result-statistics");
    if (!statsElement) return;

    const {
      totalRegions = 0,
      successfulRecognitions = 0,
      processingTime = 0,
    } = results;

    const successRate =
      totalRegions > 0
        ? Math.round((successfulRecognitions / totalRegions) * 100)
        : 0;

    statsElement.innerHTML = `
      <div class="stat-item">
        <span class="stat-label">検出された領域数:</span>
        <span class="stat-value">${totalRegions}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">認識成功数:</span>
        <span class="stat-value">${successfulRecognitions}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">認識成功率:</span>
        <span class="stat-value">${successRate}%</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">処理時間:</span>
        <span class="stat-value">${(processingTime / 1000).toFixed(2)}秒</span>
      </div>
    `;
  }

  /**
   * テキストブロックの表示
   */
  displayTextBlocks(textBlocks) {
    const blocksElement = document.getElementById("text-blocks");
    if (!blocksElement) return;

    if (textBlocks.length === 0) {
      blocksElement.innerHTML =
        '<p class="no-results">テキストが認識されませんでした。</p>';
      return;
    }

    const blocksHtml = textBlocks
      .map((block, index) => {
        const text = block.text?.text || "";
        const confidence = Math.round((block.confidence || 0) * 100);

        return `
        <div class="text-block" data-block="${index}">
          <div class="block-header">
            <span class="block-number">#${
              block.readingOrder || index + 1
            }</span>
            <span class="block-position">位置: (${block.x}, ${block.y})</span>
            <span class="block-size">サイズ: ${block.width}×${
          block.height
        }</span>
            <span class="block-confidence">信頼度: ${confidence}%</span>
          </div>
          <div class="block-text">${this.escapeHtml(text)}</div>
        </div>
      `;
      })
      .join("");

    blocksElement.innerHTML = blocksHtml;
  }

  /**
   * フォーマット済み結果の表示
   */
  displayFormattedResults(results) {
    // テキスト形式
    this.displayTextResult(results);

    // JSON形式
    if (results.json) {
      this.displayJSONResult(results.json);
    }

    // XML形式
    if (results.xml) {
      this.displayXMLResult(results.xml);
    }
  }

  /**
   * テキスト形式の表示
   */
  displayTextResult(results) {
    const textElement = document.getElementById("result-text");
    if (!textElement) return;

    let textContent = "";

    if (results.txt) {
      textContent = results.txt;
    } else if (results.textBlocks) {
      textContent = results.textBlocks
        .filter((block) => block.text?.text)
        .map((block) => block.text.text)
        .join("\n");
    }

    textElement.innerHTML = `
      <pre class="result-content-text">${this.escapeHtml(textContent)}</pre>
    `;
  }

  /**
   * JSON形式の表示
   */
  displayJSONResult(jsonData) {
    const jsonElement = document.getElementById("result-json");
    if (!jsonElement) return;

    const formattedJson = JSON.stringify(jsonData, null, 2);

    jsonElement.innerHTML = `
      <pre class="result-content-json"><code>${this.escapeHtml(
        formattedJson
      )}</code></pre>
    `;
  }

  /**
   * XML形式の表示
   */
  displayXMLResult(xmlData) {
    const xmlElement = document.getElementById("result-xml");
    if (!xmlElement) return;

    // XMLの整形
    const formattedXml = this.formatXML(xmlData);

    xmlElement.innerHTML = `
      <pre class="result-content-xml"><code>${this.escapeHtml(
        formattedXml
      )}</code></pre>
    `;
  }

  /**
   * XMLの整形
   */
  formatXML(xml) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, "application/xml");
      const serializer = new XMLSerializer();

      // 簡易的な整形（より高度な整形が必要な場合は外部ライブラリを使用）
      let formatted = serializer.serializeToString(xmlDoc);
      formatted = formatted.replace(/></g, ">\n<");

      return formatted;
    } catch (error) {
      console.warn("XML formatting failed:", error);
      return xml;
    }
  }

  /**
   * タブの切り替え
   */
  switchTab(tabId) {
    if (!this.resultTabs || !this.resultContent) return;

    // アクティブなタブを更新
    const tabButtons = this.resultTabs.querySelectorAll(".tab-button");
    tabButtons.forEach((button) => {
      if (button.dataset.tab === tabId) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });

    // コンテンツの表示切り替え
    const contentSections = this.resultContent.querySelectorAll(".tab-content");
    contentSections.forEach((section) => {
      if (section.id === `result-${tabId}`) {
        section.classList.remove("hidden");
      } else {
        section.classList.add("hidden");
      }
    });
  }

  /**
   * 結果のダウンロード
   */
  downloadResult(format) {
    if (!this.currentResults) {
      console.warn("No results to download");
      return;
    }

    let content = "";
    let filename = "";
    let mimeType = "";

    switch (format) {
      case "txt":
        content = this.generateTextContent();
        filename = "ocr_result.txt";
        mimeType = "text/plain";
        break;

      case "json":
        content = JSON.stringify(
          this.currentResults.json || this.currentResults,
          null,
          2
        );
        filename = "ocr_result.json";
        mimeType = "application/json";
        break;

      case "xml":
        content = this.currentResults.xml || this.generateXMLContent();
        filename = "ocr_result.xml";
        mimeType = "application/xml";
        break;

      default:
        console.warn("Unknown download format:", format);
        return;
    }

    this.downloadFile(content, filename, mimeType);
  }

  /**
   * テキストコンテンツの生成
   */
  generateTextContent() {
    if (this.currentResults.txt) {
      return this.currentResults.txt;
    }

    if (this.currentResults.textBlocks) {
      return this.currentResults.textBlocks
        .filter((block) => block.text?.text)
        .map((block) => block.text.text)
        .join("\n");
    }

    return "";
  }

  /**
   * XMLコンテンツの生成（フォールバック）
   */
  generateXMLContent() {
    if (!this.currentResults.textBlocks) return "";

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<document>\n';

    this.currentResults.textBlocks.forEach((block, index) => {
      xml += `  <textblock id="${index}" x="${block.x}" y="${block.y}" width="${block.width}" height="${block.height}" confidence="${block.confidence}">\n`;
      xml += `    <text>${this.escapeXML(block.text?.text || "")}</text>\n`;
      xml += "  </textblock>\n";
    });

    xml += "</document>";
    return xml;
  }

  /**
   * ファイルのダウンロード
   */
  downloadFile(content, filename, mimeType) {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      console.log(`Downloaded: ${filename}`);
    } catch (error) {
      console.error("Download failed:", error);
    }
  }

  /**
   * ダウンロードボタンの有効化
   */
  enableDownloadButtons() {
    const downloadButtons = document.querySelectorAll("[data-download]");
    downloadButtons.forEach((button) => {
      const format = button.dataset.download;

      // 対応する形式のデータが存在する場合のみ有効化
      let enabled = false;
      switch (format) {
        case "txt":
          enabled = true; // テキストは常に生成可能
          break;
        case "json":
          enabled = !!(
            this.currentResults?.json || this.currentResults?.textBlocks
          );
          break;
        case "xml":
          enabled = !!(
            this.currentResults?.xml || this.currentResults?.textBlocks
          );
          break;
      }

      button.disabled = !enabled;
    });
  }

  /**
   * HTMLエスケープ
   */
  escapeHtml(text) {
    if (typeof text !== "string") return "";

    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * XMLエスケープ
   */
  escapeXML(text) {
    if (typeof text !== "string") return "";

    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * 結果のクリア
   */
  clear() {
    this.currentResults = null;

    if (this.resultContainer) {
      this.resultContainer.classList.add("hidden");
    }

    // 各セクションをクリア
    const sections = [
      "result-statistics",
      "text-blocks",
      "result-text",
      "result-json",
      "result-xml",
    ];

    sections.forEach((sectionId) => {
      const element = document.getElementById(sectionId);
      if (element) {
        element.innerHTML = "";
      }
    });

    // ダウンロードボタンを無効化
    const downloadButtons = document.querySelectorAll("[data-download]");
    downloadButtons.forEach((button) => {
      button.disabled = true;
    });
  }

  /**
   * 結果のエクスポート（他の形式への変換）
   */
  exportResults(format) {
    if (!this.currentResults) return null;

    switch (format) {
      case "csv":
        return this.generateCSV();
      case "tsv":
        return this.generateTSV();
      default:
        return null;
    }
  }

  /**
   * CSV形式の生成
   */
  generateCSV() {
    if (!this.currentResults?.textBlocks) return "";

    const headers = [
      "読み順",
      "X座標",
      "Y座標",
      "幅",
      "高さ",
      "信頼度",
      "テキスト",
    ];
    const rows = [headers.join(",")];

    this.currentResults.textBlocks.forEach((block) => {
      const row = [
        block.readingOrder || "",
        block.x || "",
        block.y || "",
        block.width || "",
        block.height || "",
        block.confidence || "",
        `"${(block.text?.text || "").replace(/"/g, '""')}"`,
      ];
      rows.push(row.join(","));
    });

    return rows.join("\n");
  }

  /**
   * TSV形式の生成
   */
  generateTSV() {
    if (!this.currentResults?.textBlocks) return "";

    const headers = [
      "読み順",
      "X座標",
      "Y座標",
      "幅",
      "高さ",
      "信頼度",
      "テキスト",
    ];
    const rows = [headers.join("\t")];

    this.currentResults.textBlocks.forEach((block) => {
      const row = [
        block.readingOrder || "",
        block.x || "",
        block.y || "",
        block.width || "",
        block.height || "",
        block.confidence || "",
        (block.text?.text || "").replace(/\t/g, " "),
      ];
      rows.push(row.join("\t"));
    });

    return rows.join("\n");
  }

  /**
   * リソースのクリーンアップ
   */
  dispose() {
    this.clear();
  }
}
