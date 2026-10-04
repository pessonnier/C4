import { RED, YELLOW, cellAt } from "../game/board.js";

export class BoardRenderer {
  constructor(canvas, { onColumn = () => {} } = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.onColumn = onColumn;
    this.board = null;
    this.diagram = null;
    canvas.addEventListener("click", (event) => {
      const bounds = canvas.getBoundingClientRect();
      const column = Math.max(1, Math.min(7, Math.floor(((event.clientX - bounds.left) / bounds.width) * 7) + 1));
      this.onColumn(column);
    });
  }

  setPosition(board, diagram = null) {
    this.board = board;
    this.diagram = diagram;
    this.render();
  }

  render() {
    if (!this.board) return;
    const canvas = this.canvas;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 350;
    const height = canvas.clientHeight || 300;
    if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
      canvas.width = width * ratio;
      canvas.height = height * ratio;
    }
    const context = this.context;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const cell = Math.min(width / 7, height / 6);
    const ox = (width - cell * 7) / 2;
    const oy = (height - cell * 6) / 2;
    context.fillStyle = "#1757b8";
    context.beginPath();
    context.roundRect(ox, oy, cell * 7, cell * 6, cell * 0.16);
    context.fill();
    for (let column = 1; column <= 7; column += 1) {
      for (let row = 1; row <= 6; row += 1) {
        const cx = ox + (column - 0.5) * cell;
        const cy = oy + (6 - row + 0.5) * cell;
        const value = cellAt(this.board, column, row);
        context.fillStyle = value === RED ? "#ff4d57" : value === YELLOW ? "#ffd447" : "#071425";
        context.beginPath();
        context.arc(cx, cy, cell * 0.38, 0, Math.PI * 2);
        context.fill();
        if (!value && this.diagram) {
          const symbol = this.diagram[6 - row][column - 1];
          context.fillStyle = symbol === " " ? "#64748b" : "#d9f4ff";
          context.font = `700 ${Math.floor(cell * 0.32)}px ui-monospace, monospace`;
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(symbol === " " ? "·" : symbol, cx, cy);
        }
      }
    }
  }
}
