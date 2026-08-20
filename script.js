document.addEventListener("DOMContentLoaded", () => {
  // ========================================
  // 1. 获取 HTML 元素
  // ========================================

  /*
    请确认 HTML 中有这些 id：

    <div id="board"></div>
    <div id="numberKeyboard"></div>

    <button id="newGameBtn">新游戏</button>
    <button id="resetBtn">重置</button>
    <button id="checkBtn">检查答案</button>

    如果你的 id 名称不同，只需要修改下面对应的引号内容。
  */
  const boardElement = document.getElementById("board");
  const numberKeyboard = document.getElementById("numberKeyboard");

  const newGameButton = document.getElementById("newGameBtn");
  const resetButton = document.getElementById("resetBtn");
  const checkButton = document.getElementById("checkBtn");

  // 找不到棋盘时停止，避免后续报错
  if (!boardElement) {
    console.error('找不到棋盘，请确认 HTML 中有：<div id="board"></div>');
    return;
  }

  // ========================================
  // 2. 游戏数据
  // ========================================

  let currentPuzzle = [];
  let solution = [];
  let playerBoard = [];
  let selectedCell = null;

  /*
    题目保留的初始数字数量。

    数值越高：空格越少、越简单
    数值越低：空格越多、越难

    推荐：
    45 = 简单
    40 = 中等
    35 = 较难
  */
  const CLUE_COUNT = 40;

  // ========================================
  // 3. 基础工具函数
  // ========================================

  // 深拷贝二维数组
  function copyBoard(board) {
    return board.map(row => [...row]);
  }

  // 创建 9 × 9 空棋盘
  function createEmptyBoard() {
    return Array.from({ length: 9 }, () => Array(9).fill(0));
  }

  // 打乱数组，且不影响原数组
  function shuffle(array) {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
      const randomIndex = Math.floor(Math.random() * (i + 1));

      [result[i], result[randomIndex]] =
        [result[randomIndex], result[i]];
    }

    return result;
  }

  // ========================================
  // 4. 数独规则与生成算法
  // ========================================

  // 判断 number 能否填入 board[row][col]
  function isValid(board, row, col, number) {
    // 检查行
    for (let i = 0; i < 9; i++) {
      if (board[row][i] === number) {
        return false;
      }
    }

    // 检查列
    for (let i = 0; i < 9; i++) {
      if (board[i][col] === number) {
        return false;
      }
    }

    // 检查 3 × 3 宫格
    const boxRowStart = Math.floor(row / 3) * 3;
    const boxColStart = Math.floor(col / 3) * 3;

    for (let i = boxRowStart; i < boxRowStart + 3; i++) {
      for (let j = boxColStart; j < boxColStart + 3; j++) {
        if (board[i][j] === number) {
          return false;
        }
      }
    }

    return true;
  }

  /*
    生成完整数独答案。

    先使用一个固定正确的数独排列规则，
    再随机交换数字、行、列、宫格，
    因此能快速得到完全合法且随机的终盘。
  */
  function generateFullBoard() {
    const board = createEmptyBoard();

    // 生成基础终盘
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        board[row][col] = ((row * 3 + Math.floor(row / 3) + col) % 9) + 1;
      }
    }

    // 随机替换 1～9 的数字
    const numberMap = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        board[row][col] = numberMap[board[row][col] - 1];
      }
    }

    // 随机交换三个“大行带”
    const rowBands = shuffle([0, 1, 2]);
    const newRowOrder = [];

    rowBands.forEach(band => {
      const rowsInsideBand = shuffle([0, 1, 2]);

      rowsInsideBand.forEach(rowInsideBand => {
        newRowOrder.push(band * 3 + rowInsideBand);
      });
    });

    const rowShuffledBoard = newRowOrder.map(row => [...board[row]]);

    // 随机交换三个“大列带”
    const colStacks = shuffle([0, 1, 2]);
    const newColOrder = [];

    colStacks.forEach(stack => {
      const colsInsideStack = shuffle([0, 1, 2]);

      colsInsideStack.forEach(colInsideStack => {
        newColOrder.push(stack * 3 + colInsideStack);
      });
    });

    const finalBoard = rowShuffledBoard.map(row => {
      return newColOrder.map(col => row[col]);
    });

    return finalBoard;
  }

  /*
    找一个空格，并计算它的候选数字。
    优先寻找候选数最少的空格，可加快唯一解检测。
  */
  function findBestEmptyCell(board) {
    let bestCell = null;
    let smallestCandidateCount = 10;

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row][col] !== 0) {
          continue;
        }

        const candidates = [];

        for (let number = 1; number <= 9; number++) {
          if (isValid(board, row, col, number)) {
            candidates.push(number);
          }
        }

        // 没有候选数，代表此盘面无解
        if (candidates.length === 0) {
          return { row, col, candidates: [] };
        }

        if (candidates.length < smallestCandidateCount) {
          smallestCandidateCount = candidates.length;

          bestCell = {
            row,
            col,
            candidates
          };

          // 只有一个候选数时，优先返回
          if (candidates.length === 1) {
            return bestCell;
          }
        }
      }
    }

    return bestCell;
  }

  /*
    计算棋盘有几个答案。

    limit = 2：
    只要发现有两个答案就停止。
    因为我们只需要判断“是否唯一解”。
  */
  function countSolutions(board, limit = 2) {
    const emptyCell = findBestEmptyCell(board);

    // 没有空格：找到一种完整解
    if (!emptyCell) {
      return 1;
    }

    const { row, col, candidates } = emptyCell;
    let total = 0;

    for (const number of candidates) {
      board[row][col] = number;

      total += countSolutions(board, limit);

      // 回溯：恢复为空格
      board[row][col] = 0;

      // 至少两种解，不需要继续计算
      if (total >= limit) {
        return total;
      }
    }

    return total;
  }

  /*
    从完整答案中随机挖空。

    每次挖掉一个数字后，都检查是否仍然只有唯一解：
    - 唯一解：保留空格
    - 多解：恢复数字
  */
  function createPuzzleFromSolution(fullBoard, targetClues) {
    const puzzle = copyBoard(fullBoard);

    const positions = shuffle(
      Array.from({ length: 81 }, (_, index) => index)
    );

    let currentClues = 81;

    for (const position of positions) {
      if (currentClues <= targetClues) {
        break;
      }

      const row = Math.floor(position / 9);
      const col = position % 9;

      const backupNumber = puzzle[row][col];

      // 尝试挖空
      puzzle[row][col] = 0;

      // 检查挖空后是否仍然唯一解
      const testBoard = copyBoard(puzzle);
      const solutionCount = countSolutions(testBoard, 2);

      if (solutionCount === 1) {
        currentClues--;
      } else {
        // 有多个答案时，恢复该数字
        puzzle[row][col] = backupNumber;
      }
    }

    return puzzle;
  }

  // 自动生成一局游戏：题目 + 标准答案
  function generateSudokuGame() {
    const fullBoard = generateFullBoard();

    const puzzle = createPuzzleFromSolution(
      fullBoard,
      CLUE_COUNT
    );

    return {
      puzzle: puzzle,
      solution: fullBoard
    };
  }

  // ========================================
  // 5. 渲染数独棋盘
  // ========================================

  function renderBoard() {
    boardElement.innerHTML = "";

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const cell = document.createElement("button");

        const value = playerBoard[row][col];
        const isFixed = currentPuzzle[row][col] !== 0;

        cell.className = "cell";
        cell.dataset.row = row;
        cell.dataset.col = col;

        // 0 代表空格，因此不显示
        cell.textContent = value === 0 ? "" : value;

        if (isFixed) {
          cell.classList.add("fixed");
        } else {
          cell.classList.add("editable");
        }

        /*
          所有格子都可以点击，
          包括固定的黑色数字。
        */
        cell.addEventListener("click", () => {
          selectCell(row, col);
        });

        boardElement.appendChild(cell);
      }
    }

    updateBoardStyle();
    updateNumberKeyboard();
  }

    // 统计棋盘中的数字；某数字总数达到 9 个时隐藏对应按钮
  function updateNumberKeyboard() {
    const numberButtons = document.querySelectorAll(".number-btn");

    numberButtons.forEach(button => {
      const number = Number(button.dataset.number);

      // 没有 data-number 的按钮不处理
      if (number < 1 || number > 9) {
        return;
      }

      let count = 0;

      // 统计当前棋盘中该数字的出现数量
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          if (playerBoard[row][col] === number) {
            count++;
          }
        }
      }

      // 数独中一个数字最多有 9 个
      button.classList.toggle("number-complete", count >= 9);
    });
  }


  // ========================================
  // 6. 选中、高亮、冲突检测
  // ========================================

  function selectCell(row, col) {
    selectedCell = { row, col };
    updateBoardStyle();
  }

  // 获取全部冲突格子的位置
  function getConflictPositions() {
    const conflicts = new Set();

    // 检查一组位置中的重复数字
    function checkGroup(positions) {
      const numberPositions = new Map();

      positions.forEach(({ row, col }) => {
        const value = playerBoard[row][col];

        // 空格不检查
        if (value === 0) {
          return;
        }

        if (!numberPositions.has(value)) {
          numberPositions.set(value, []);
        }

        numberPositions.get(value).push({ row, col });
      });

      numberPositions.forEach(positionList => {
        // 一个数字出现两次或更多，全部算冲突
        if (positionList.length > 1) {
          positionList.forEach(({ row, col }) => {
            conflicts.add(`${row}-${col}`);
          });
        }
      });
    }

    // 检查九行
    for (let row = 0; row < 9; row++) {
      const positions = [];

      for (let col = 0; col < 9; col++) {
        positions.push({ row, col });
      }

      checkGroup(positions);
    }

    // 检查九列
    for (let col = 0; col < 9; col++) {
      const positions = [];

      for (let row = 0; row < 9; row++) {
        positions.push({ row, col });
      }

      checkGroup(positions);
    }

    // 检查九个 3 × 3 宫格
    for (let boxRow = 0; boxRow < 3; boxRow++) {
      for (let boxCol = 0; boxCol < 3; boxCol++) {
        const positions = [];

        for (let row = boxRow * 3; row < boxRow * 3 + 3; row++) {
          for (let col = boxCol * 3; col < boxCol * 3 + 3; col++) {
            positions.push({ row, col });
          }
        }

        checkGroup(positions);
      }
    }

    return conflicts;
  }

  // 给冲突格添加 conflict 样式
  function markConflicts() {
    const conflicts = getConflictPositions();

    conflicts.forEach(position => {
      const [row, col] = position.split("-");

      const cell = boardElement.querySelector(
        `.cell[data-row="${row}"][data-col="${col}"]`
      );

      if (cell) {
        cell.classList.add("conflict");
      }
    });
  }

  // 更新选中、高亮、冲突样式
  function updateBoardStyle() {
    const cells = boardElement.querySelectorAll(".cell");

    // 每次先清除旧状态
    cells.forEach(cell => {
      cell.classList.remove(
        "selected",
        "related",
        "same-number",
        "conflict"
      );
    });

    // 没选格子时，只显示冲突
    if (!selectedCell) {
      markConflicts();
      return;
    }

    const selectedRow = selectedCell.row;
    const selectedCol = selectedCell.col;
    const selectedValue = playerBoard[selectedRow][selectedCol];

    const selectedBoxRow = Math.floor(selectedRow / 3);
    const selectedBoxCol = Math.floor(selectedCol / 3);

    cells.forEach(cell => {
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);

      const currentBoxRow = Math.floor(row / 3);
      const currentBoxCol = Math.floor(col / 3);

      const isSelected = row === selectedRow && col === selectedCol;

      const isSameRow = row === selectedRow;
      const isSameCol = col === selectedCol;

      const isSameBox =
        currentBoxRow === selectedBoxRow &&
        currentBoxCol === selectedBoxCol;

      // 被选中的格子：深蓝色
      if (isSelected) {
        cell.classList.add("selected");
      }
      // 同行、同列、同宫：浅蓝色
      else if (isSameRow || isSameCol || isSameBox) {
        cell.classList.add("related");
      }

      // 选中数字时，全盘相同数字高亮
      if (
        selectedValue !== 0 &&
        playerBoard[row][col] === selectedValue
      ) {
        cell.classList.add("same-number");
      }
    });

    // 最后标记冲突
    markConflicts();
  }

  // ========================================
  // 7. 底部数字键盘
  // ========================================

// 创建底部数字键盘
function createNumberKeyboard() {
  // 如果 HTML 已经写好了数字按钮，就直接使用已有按钮
  // 同时包含 .erase-btn，确保擦除按钮也能绑定事件
  const existingButtons = document.querySelectorAll(
    ".number-btn, .erase-btn, .erase-key"
  );

  if (existingButtons.length > 0) {
    existingButtons.forEach(button => {
      // 防止按钮在 form 中被当成提交按钮
      button.type = "button";

      button.addEventListener("click", () => {
        const text = button.textContent.trim();

        // 擦除按钮
        if (
          button.classList.contains("erase-btn") ||
          button.classList.contains("erase-key") ||
          text === "擦除" ||
          text === "删除" ||
          text === "⌫"
        ) {
          eraseNumber();
          return;
        }

        // 数字 1～9
        const number = Number(button.dataset.number || text);

        if (number >= 1 && number <= 9) {
          fillNumber(number);
        }
      });
    });

    return;
  }


  // 如果 HTML 没有数字按钮，则自动创建
  if (!numberKeyboard) {
    console.error("找不到数字键盘容器，也找不到 .number-btn 按钮。");
    return;
  }

  numberKeyboard.innerHTML = "";

  for (let number = 1; number <= 9; number++) {
    const numberButton = document.createElement("button");

    numberButton.type = "button";
    numberButton.className = "number-btn";
    numberButton.textContent = number;

    numberButton.addEventListener("click", () => {
      fillNumber(number);
    });

    numberKeyboard.appendChild(numberButton);
  }

  const eraseButton = document.createElement("button");

  eraseButton.type = "button";
  eraseButton.className = "number-btn erase-key";
  eraseButton.textContent = "擦除";

  eraseButton.addEventListener("click", eraseNumber);

  numberKeyboard.appendChild(eraseButton);
}


  // 向选中格填写数字
  function fillNumber(number) {
    if (!selectedCell) {
      return;
    }

    const { row, col } = selectedCell;

    // 固定数字不可修改
    if (currentPuzzle[row][col] !== 0) {
      return;
    }

    playerBoard[row][col] = number;

    renderBoard();
    checkAutoComplete();
  }

  
  // 擦除选中格数字
  function eraseNumber() {
    if (!selectedCell) {
      return;
    }

    const { row, col } = selectedCell;

    // 固定数字不可删除
    if (currentPuzzle[row][col] !== 0) {
      return;
    }

    playerBoard[row][col] = 0;

    renderBoard();
  }

  // ========================================
  // 8. 游戏控制
  // ========================================

  // 新游戏：自动随机生成题目
  function startNewGame() {
    if (newGameButton) {
      newGameButton.disabled = true;
      newGameButton.textContent = "生成中...";
    }

    /*
      等浏览器先显示“生成中...”，
      再开始生成题目，避免按钮看起来没有反应。
    */
    setTimeout(() => {
      const game = generateSudokuGame();

      currentPuzzle = copyBoard(game.puzzle);
      solution = copyBoard(game.solution);
      playerBoard = copyBoard(game.puzzle);

      selectedCell = null;

      renderBoard();

      if (newGameButton) {
        newGameButton.disabled = false;
        newGameButton.textContent = "新游戏";
      }
    }, 30);
  }

  // 重置：恢复本局最开始的题目
  function resetGame() {
    if (currentPuzzle.length === 0) {
      return;
    }

    playerBoard = copyBoard(currentPuzzle);
    selectedCell = null;

    renderBoard();
  }

  // 判断棋盘有没有填满
  function isBoardFull() {
    return playerBoard.every(row => {
      return row.every(value => value !== 0);
    });
  }

  // 判断当前棋盘是否与答案一致
  function isBoardCorrect() {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (playerBoard[row][col] !== solution[row][col]) {
          return false;
        }
      }
    }

    return true;
  }

  // 点击检查答案
  function checkAnswer() {
    if (!isBoardFull()) {
      alert("还有空格没有填写完。");
      return;
    }

    if (isBoardCorrect()) {
      alert("恭喜你，全部正确！");
    } else {
      alert("答案中还有错误，请继续检查。");
    }
  }

  // 玩家填完后自动提示成功
  function checkAutoComplete() {
    if (isBoardFull() && isBoardCorrect()) {
      setTimeout(() => {
        alert("恭喜你，数独完成！");
      }, 100);
    }
  }

  // ========================================
  // 9. 按钮事件
  // ========================================

  if (newGameButton) {
    newGameButton.addEventListener("click", startNewGame);
  }

  if (resetButton) {
    resetButton.addEventListener("click", resetGame);
  }

  if (checkButton) {
    checkButton.addEventListener("click", checkAnswer);
  }

  // ========================================
  // 10. 电脑键盘事件
  // ========================================

  document.addEventListener("keydown", event => {
    // 数字 1～9 填数
    if (/^[1-9]$/.test(event.key)) {
      fillNumber(Number(event.key));
    }

    // Backspace 或 Delete 擦除
    if (event.key === "Backspace" || event.key === "Delete") {
      eraseNumber();
    }
  });

  // ========================================
  // 11. 初始化
  // ========================================

  createNumberKeyboard();
  startNewGame();
});
