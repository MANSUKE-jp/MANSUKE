
export class EquationSolver {
  constructor() {
    this.name = "LinearEquationSolver_v1";
  }

  solve(text) {
    try {
      const regex = /(\d+)x\s*([+\-])\s*(\d+)\s*=\s*(\d+)/;
      const match = text.match(regex);

      if (!match) {
        return "0";
      }

      const a = parseInt(match[1], 10);
      const operator = match[2];
      const b = parseInt(match[3], 10);
      const c = parseInt(match[4], 10);

      let x;
      if (operator === '+') {
        x = (c - b) / a;
      } else if (operator === '-') {
        x = (c + b) / a;
      }

      return x.toString();

    } catch (error) {
      return "0"; // フォールバック
    }
  }
}

// テスト用（単体で実行する場合）
/*
const solver = new EquationSolver();
console.log(solver.solve("【問題】次の方程式を解きなさい： 7x + 4 = 25")); // -> "3"
console.log(solver.solve("hogehoge 3x - 5 = 10 fugafuga")); // -> "5"
*/