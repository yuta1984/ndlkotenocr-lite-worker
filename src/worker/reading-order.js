/**
 * 読み順処理モジュール
 * 古典籍特有の読み順に基づいてテキストブロックを並び替え
 */

export class ReadingOrderProcessor {
  constructor() {
    this.readingDirection = "vertical"; // vertical (縦書き) or horizontal (横書き)
    this.columnDirection = "right-to-left"; // right-to-left or left-to-right
  }

  /**
   * テキストブロックの読み順を処理
   */
  process(textBlocks, options = {}) {
    if (!textBlocks || textBlocks.length === 0) {
      return [];
    }

    const {
      readingDirection = this.readingDirection,
      columnDirection = this.columnDirection,
      groupThreshold = 20, // 同一行/列とみなす閾値（ピクセル）
      minConfidence = 0.1, // 最低信頼度
    } = options;

    // 信頼度でフィルタリング
    const validBlocks = textBlocks.filter(
      (block) =>
        block.confidence >= minConfidence &&
        block.text &&
        block.text.text &&
        block.text.text.trim().length > 0
    );

    if (validBlocks.length === 0) {
      return [];
    }

    // 読み順に応じて処理
    let orderedBlocks;
    if (readingDirection === "vertical") {
      orderedBlocks = this.processVerticalReading(
        validBlocks,
        columnDirection,
        groupThreshold
      );
    } else {
      orderedBlocks = this.processHorizontalReading(
        validBlocks,
        columnDirection,
        groupThreshold
      );
    }

    // 読み順インデックスを付与
    return orderedBlocks.map((block, index) => ({
      ...block,
      readingOrder: index + 1,
    }));
  }

  /**
   * 縦書き読み順の処理
   */
  processVerticalReading(blocks, columnDirection, groupThreshold) {
    // 1. 列（カラム）にグループ化
    const columns = this.groupIntoColumns(blocks, groupThreshold);

    // 2. 列を左右の順序で並び替え
    const sortedColumns = this.sortColumnsByDirection(columns, columnDirection);

    // 3. 各列内で上から下の順序で並び替え
    const orderedBlocks = [];
    for (const column of sortedColumns) {
      const sortedBlocks = column.sort((a, b) => a.y - b.y);
      orderedBlocks.push(...sortedBlocks);
    }

    return orderedBlocks;
  }

  /**
   * 横書き読み順の処理
   */
  processHorizontalReading(blocks, columnDirection, groupThreshold) {
    // 1. 行（ライン）にグループ化
    const lines = this.groupIntoLines(blocks, groupThreshold);

    // 2. 行を上下の順序で並び替え
    const sortedLines = lines.sort((a, b) => {
      const avgYA = a.reduce((sum, block) => sum + block.y, 0) / a.length;
      const avgYB = b.reduce((sum, block) => sum + block.y, 0) / b.length;
      return avgYA - avgYB;
    });

    // 3. 各行内で左右の順序で並び替え
    const orderedBlocks = [];
    for (const line of sortedLines) {
      const sortedBlocks =
        columnDirection === "left-to-right"
          ? line.sort((a, b) => a.x - b.x)
          : line.sort((a, b) => b.x - a.x);
      orderedBlocks.push(...sortedBlocks);
    }

    return orderedBlocks;
  }

  /**
   * ブロックを列にグループ化
   */
  groupIntoColumns(blocks, threshold) {
    const columns = [];

    for (const block of blocks) {
      const centerX = block.x + block.width / 2;

      // 既存の列で近いものを探す
      let assignedColumn = null;
      for (const column of columns) {
        const columnCenterX =
          column.reduce((sum, b) => sum + (b.x + b.width / 2), 0) /
          column.length;

        if (Math.abs(centerX - columnCenterX) <= threshold) {
          assignedColumn = column;
          break;
        }
      }

      if (assignedColumn) {
        assignedColumn.push(block);
      } else {
        columns.push([block]);
      }
    }

    return columns;
  }

  /**
   * ブロックを行にグループ化
   */
  groupIntoLines(blocks, threshold) {
    const lines = [];

    for (const block of blocks) {
      const centerY = block.y + block.height / 2;

      // 既存の行で近いものを探す
      let assignedLine = null;
      for (const line of lines) {
        const lineCenterY =
          line.reduce((sum, b) => sum + (b.y + b.height / 2), 0) / line.length;

        if (Math.abs(centerY - lineCenterY) <= threshold) {
          assignedLine = line;
          break;
        }
      }

      if (assignedLine) {
        assignedLine.push(block);
      } else {
        lines.push([block]);
      }
    }

    return lines;
  }

  /**
   * 列を方向に応じて並び替え
   */
  sortColumnsByDirection(columns, direction) {
    return columns.sort((a, b) => {
      const avgXA =
        a.reduce((sum, block) => sum + (block.x + block.width / 2), 0) /
        a.length;
      const avgXB =
        b.reduce((sum, block) => sum + (block.x + block.width / 2), 0) /
        b.length;

      return direction === "right-to-left" ? avgXB - avgXA : avgXA - avgXB;
    });
  }

  /**
   * 自動読み順検出
   */
  detectReadingOrder(blocks) {
    if (!blocks || blocks.length < 2) {
      return {
        readingDirection: "vertical",
        columnDirection: "right-to-left",
      };
    }

    // ブロックの配置を分析
    const analysis = this.analyzeLayout(blocks);

    // 縦書き vs 横書きの判定
    const isVertical = analysis.verticalVariance > analysis.horizontalVariance;

    // 列/行の方向判定
    let direction;
    if (isVertical) {
      // 縦書きの場合、右から左が一般的
      direction =
        analysis.rightToLeftScore > analysis.leftToRightScore
          ? "right-to-left"
          : "left-to-right";
    } else {
      // 横書きの場合、左から右が一般的
      direction =
        analysis.leftToRightScore > analysis.rightToLeftScore
          ? "left-to-right"
          : "right-to-left";
    }

    return {
      readingDirection: isVertical ? "vertical" : "horizontal",
      columnDirection: direction,
      confidence:
        Math.max(analysis.verticalVariance, analysis.horizontalVariance) /
        (analysis.verticalVariance + analysis.horizontalVariance),
    };
  }

  /**
   * レイアウト分析
   */
  analyzeLayout(blocks) {
    const xPositions = blocks.map((b) => b.x + b.width / 2);
    const yPositions = blocks.map((b) => b.y + b.height / 2);

    // 分散を計算
    const verticalVariance = this.calculateVariance(xPositions);
    const horizontalVariance = this.calculateVariance(yPositions);

    // 読み方向のスコア計算
    let leftToRightScore = 0;
    let rightToLeftScore = 0;

    for (let i = 0; i < blocks.length - 1; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const blockA = blocks[i];
        const blockB = blocks[j];

        const deltaX =
          blockB.x + blockB.width / 2 - (blockA.x + blockA.width / 2);
        const deltaY =
          blockB.y + blockB.height / 2 - (blockA.y + blockA.height / 2);

        // 水平方向の配置関係を評価
        if (Math.abs(deltaY) < 50) {
          // 同じ行とみなす
          if (deltaX > 0) leftToRightScore++;
          else rightToLeftScore++;
        }
      }
    }

    return {
      verticalVariance,
      horizontalVariance,
      leftToRightScore,
      rightToLeftScore,
    };
  }

  /**
   * 分散の計算
   */
  calculateVariance(values) {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;

    return variance;
  }

  /**
   * 読み順の妥当性検証
   */
  validateReadingOrder(orderedBlocks) {
    const issues = [];

    for (let i = 0; i < orderedBlocks.length - 1; i++) {
      const current = orderedBlocks[i];
      const next = orderedBlocks[i + 1];

      // 極端な位置ジャンプを検出
      const deltaX = Math.abs(
        next.x + next.width / 2 - (current.x + current.width / 2)
      );
      const deltaY = Math.abs(
        next.y + next.height / 2 - (current.y + current.height / 2)
      );

      if (deltaX > 300 || deltaY > 300) {
        issues.push({
          type: "large_jump",
          position: i,
          deltaX,
          deltaY,
          message: `Large position jump between blocks ${i} and ${i + 1}`,
        });
      }

      // 重複する領域を検出
      const overlap = this.calculateOverlap(current, next);
      if (overlap > 0.5) {
        issues.push({
          type: "overlap",
          position: i,
          overlap,
          message: `Significant overlap between blocks ${i} and ${i + 1}`,
        });
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * 二つのブロックの重複率を計算
   */
  calculateOverlap(blockA, blockB) {
    const xOverlap = Math.max(
      0,
      Math.min(blockA.x + blockA.width, blockB.x + blockB.width) -
        Math.max(blockA.x, blockB.x)
    );
    const yOverlap = Math.max(
      0,
      Math.min(blockA.y + blockA.height, blockB.y + blockB.height) -
        Math.max(blockA.y, blockB.y)
    );

    const overlapArea = xOverlap * yOverlap;
    const unionArea =
      blockA.width * blockA.height + blockB.width * blockB.height - overlapArea;

    return unionArea > 0 ? overlapArea / unionArea : 0;
  }

  /**
   * 設定の更新
   */
  updateSettings(settings) {
    if (settings.readingDirection) {
      this.readingDirection = settings.readingDirection;
    }
    if (settings.columnDirection) {
      this.columnDirection = settings.columnDirection;
    }
  }
}
