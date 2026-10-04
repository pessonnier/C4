import { RED, YELLOW, boardKey, legalMoves, play, sideToMove } from "../game/board.js";
import { decodeMask } from "../game/bitboard.js";
import { hasWon, immediateWinningMoves, isFull } from "../game/rules.js";
import { steadyStatePolicy } from "../strategy/policy.js";
import { StrategyOutcomeAnalyzer } from "../strategy/outcome-analysis.js";

function boardFromNode(node) {
  return Object.freeze({ redMask: decodeMask(node.redMask), yellowMask: decodeMask(node.yellowMask), ply: node.ply });
}

export class GameNavigation {
  constructor(graph, { onChange = () => {}, mode = "weakc4" } = {}) {
    this.graph = graph;
    this.onChange = onChange;
    this.mode = mode;
    this.nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    this.nodeByBoard = new Map(graph.nodes.map((node) => [node.boardKey, node]));
    this.outgoing = new Map(graph.nodes.map((node) => [node.id, []]));
    graph.edges.forEach((edge) => this.outgoing.get(edge.source)?.push(edge));
    this.outcomeAnalyzer = new StrategyOutcomeAnalyzer(graph);
    this.reset();
  }

  setMode(mode) {
    if (!new Set(["weakc4", "two-player"]).has(mode)) throw new Error(`mode inconnu: ${mode}`);
    this.mode = mode;
    this.reset();
  }

  reset() {
    this.node = this.nodes.get(this.graph.metadata.rootId);
    this.board = boardFromNode(this.node);
    this.diagram = null;
    this.diagramId = null;
    if (this.mode === "weakc4") {
      this.status = "Rouge suit la stratégie d’ouverture.";
      this.advanceRed();
    } else {
      this.status = "Mode deux joueurs — Rouge commence.";
      this.emit();
    }
  }

  selectNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    this.node = node;
    this.board = boardFromNode(node);
    this.diagram = node.steadyStateDiagram ?? null;
    this.diagramId = node.steadyStateId ?? null;
    this.status = "Position du graphe sélectionnée.";
    this.emit();
  }

  continueFromNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    this.node = node;
    this.board = boardFromNode(node);
    this.diagram = node.steadyStateDiagram ?? null;
    this.diagramId = node.steadyStateId ?? null;
    if (this.mode === "weakc4" && sideToMove(this.board) === RED) {
      this.advanceRed();
    } else {
      const player = sideToMove(this.board) === RED ? "Rouge" : "Jaune";
      this.status = `Partie reprise depuis ce nœud — ${player} doit jouer.`;
      this.emit();
    }
    return true;
  }

  playColumn(column) {
    return this.mode === "two-player" ? this.playTwoPlayer(column) : this.playYellow(column);
  }

  playTwoPlayer(column) {
    const player = sideToMove(this.board);
    if (!legalMoves(this.board).includes(column)) {
      this.status = `La colonne ${column} est pleine.`;
      this.emit();
      return false;
    }
    const followsDiagram = !this.diagram || player !== RED || steadyStatePolicy(this.board, this.diagram) === column;
    this.board = play(this.board, column, player);
    if (!followsDiagram) {
      this.diagram = null;
      this.diagramId = null;
    }
    const exactNode = this.nodeByBoard.get(boardKey(this.board)) ?? null;
    this.node = exactNode;
    if (!this.diagram && exactNode?.kind === "STEADY_STATE") {
      this.diagram = exactNode.steadyStateDiagram;
      this.diagramId = exactNode.steadyStateId;
    }
    if (hasWon(this.board, player)) {
      this.status = `${player === RED ? "Rouge" : "Jaune"} joue ${column} et gagne.`;
    } else if (isFull(this.board)) {
      this.status = "Match nul — le plateau est plein.";
    } else {
      const next = sideToMove(this.board) === RED ? "Rouge" : "Jaune";
      this.status = `${player === RED ? "Rouge" : "Jaune"} joue ${column}. À ${next} de jouer.`;
    }
    this.emit();
    return true;
  }

  playYellow(column) {
    if (sideToMove(this.board) !== YELLOW) {
      this.status = "Ce n’est pas au tour de Jaune.";
      this.emit();
      return false;
    }
    if (!legalMoves(this.board).includes(column)) {
      this.status = `La colonne ${column} est pleine.`;
      this.emit();
      return false;
    }
    this.board = play(this.board, column, YELLOW);
    if (!this.diagram) {
      const child = this.nodeByBoard.get(boardKey(this.board));
      if (child) {
        this.node = child;
        this.diagram = child.steadyStateDiagram ?? null;
        this.diagramId = child.steadyStateId ?? null;
      }
    }
    this.advanceRed();
    return true;
  }

  advanceRed() {
    if (sideToMove(this.board) !== RED) {
      this.status = "À Jaune de jouer — choisissez une colonne.";
      this.emit();
      return;
    }
    let move;
    if (this.diagram) {
      try {
        move = steadyStatePolicy(this.board, this.diagram);
      } catch (error) {
        this.status = error.message;
        this.emit();
        return;
      }
    } else {
      const current = this.nodeByBoard.get(boardKey(this.board));
      if (current?.kind === "STEADY_STATE") {
        this.node = current;
        this.diagram = current.steadyStateDiagram;
        this.diagramId = current.steadyStateId;
        move = steadyStatePolicy(this.board, this.diagram);
      } else {
        const edge = (this.outgoing.get(current?.id) ?? []).find((candidate) => candidate.player === RED);
        if (edge) {
          move = edge.column;
          this.node = this.nodes.get(edge.target);
        } else {
          move = immediateWinningMoves(this.board, RED)[0];
        }
      }
    }
    if (!move) {
      this.status = "Aucun coup Rouge n’est couvert par la stratégie.";
      this.emit();
      return;
    }
    this.board = play(this.board, move, RED);
    if (hasWon(this.board, RED)) {
      this.status = `Rouge joue ${move} et gagne.`;
      this.emit();
      return;
    }
    if (!this.diagram) {
      const next = this.nodeByBoard.get(boardKey(this.board));
      if (next) this.node = next;
    }
    const wins = immediateWinningMoves(this.board, RED);
    this.status = wins.length
      ? `Rouge joue ${move}. À Jaune ; Rouge menace ${wins.join(", ")}.`
      : `Rouge joue ${move}. À Jaune de jouer.`;
    this.emit();
  }

  emit() {
    let analysis = null;
    if (!hasWon(this.board, RED) && !hasWon(this.board, YELLOW) && !isFull(this.board)) {
      const exactNode = this.nodeByBoard.get(boardKey(this.board));
      analysis = this.outcomeAnalyzer.position(this.board, {
        nodeId: exactNode?.id ?? null,
        diagram: this.diagram,
        diagramId: this.diagramId,
      });
    }
    this.onChange({
      node: this.node,
      board: this.board,
      diagram: this.diagram,
      status: this.status,
      analysis,
      mode: this.mode,
    });
  }
}
