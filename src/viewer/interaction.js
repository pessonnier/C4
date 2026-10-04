import { BoardRenderer } from "./board-renderer.js";
import { GraphRenderer } from "./graph-renderer.js";
import { GameNavigation } from "./navigation.js";
import { decodeMask } from "../game/bitboard.js";
import { RED, YELLOW, legalMoves } from "../game/board.js";
import { classifyColumn } from "../strategy/outcome-analysis.js";

function boardFromNode(node) {
  return Object.freeze({ redMask: decodeMask(node.redMask), yellowMask: decodeMask(node.yellowMask), ply: node.ply });
}

export function mountViewer(graph, elements) {
  const indegree = new Map(graph.nodes.map((node) => [node.id, 0]));
  const outdegree = new Map(graph.nodes.map((node) => [node.id, 0]));
  graph.edges.forEach((edge) => {
    indegree.set(edge.target, indegree.get(edge.target) + 1);
    outdegree.set(edge.source, outdegree.get(edge.source) + 1);
  });

  let navigation;
  let selectedNodeId = graph.metadata.rootId;
  const boardRenderer = new BoardRenderer(elements.board, {
    onColumn: (column) => navigation.playColumn(column),
  });
  const graphRenderer = new GraphRenderer(elements.graph, graph, {
    onSelect: (node) => showNode(node),
  });
  const formatCount = (value) => (value ?? 0n).toLocaleString("fr-FR");

  function renderAnalysis(analysis, player = YELLOW, legal = []) {
    if (!analysis) {
      elements.redWins.textContent = "0";
      elements.yellowWins.textContent = "0";
      elements.draws.textContent = "0";
      elements.columnAnalysis.innerHTML = '<span class="analysis-empty">Partie terminée.</span>';
      return;
    }
    elements.redWins.textContent = formatCount(analysis.totals.redWins);
    elements.yellowWins.textContent = formatCount(analysis.totals.yellowWins);
    elements.draws.textContent = formatCount(analysis.totals.draws);
    elements.analysisBasis.textContent = analysis.basis === "complete-game-lines"
      ? "Lignes terminales exactes du diagramme actif"
      : analysis.basis === "unavailable"
        ? "Position hors solution faible — ces coups ne sont pas évalués par WeakC4"
        : "Chemins du graphe de preuve — un Steady State vaut un certificat de victoire";
    elements.analysisPerspective.textContent = player === RED ? "pour Rouge au trait" : "pour Jaune au trait";
    const labels = { WIN: "victoire", LOSS: "défaite", DRAW: "nul", MIXED: "mixte", OUTSIDE: "hors stratégie" };
    elements.columnAnalysis.innerHTML = [1, 2, 3, 4, 5, 6, 7].map((column) => {
      const result = analysis.columns[column];
      const isLegal = legal.includes(column);
      const verdict = result ? classifyColumn(result, player) : isLegal ? "OUTSIDE" : "ILLEGAL";
      const redPaths = result ? formatCount(result.redWins) : "—";
      const yellowPaths = result ? formatCount(result.yellowWins) : "—";
      const title = result
        ? `Rouge ${redPaths} · Jaune ${yellowPaths} · Nuls ${formatCount(result.draws)}`
        : isLegal ? "Ce coup n'appartient pas à la solution faible" : "Colonne pleine";
      return `<span class="column-result ${verdict.toLowerCase()}" title="${title}">
        <b>${column}</b><small>${labels[verdict] ?? "fermée"}</small>
        <span class="column-paths"><em class="path-red"><i>R</i>${redPaths}</em><em class="path-yellow"><i>J</i>${yellowPaths}</em></span>
      </span>`;
    }).join("");
  }

  function updateMode(mode) {
    elements.modeWeakc4.classList.toggle("active", mode === "weakc4");
    elements.modeTwoPlayer.classList.toggle("active", mode === "two-player");
    elements.modeWeakc4.setAttribute("aria-pressed", String(mode === "weakc4"));
    elements.modeTwoPlayer.setAttribute("aria-pressed", String(mode === "two-player"));
    elements.playHint.textContent = mode === "weakc4"
      ? "Vous jouez Jaune. Rouge répond automatiquement selon WeakC4."
      : "Deux joueurs locaux alternent librement. Les informations WeakC4 restent visibles.";
  }

  function showNode(node) {
    selectedNodeId = node.id;
    const board = boardFromNode(node);
    boardRenderer.setPosition(board, node.steadyStateDiagram ?? null);
    elements.details.innerHTML = [
      ["Séquence", node.representativeMoves || "∅"],
      ["Coup", node.ply],
      ["Trait", node.sideToMove],
      ["Type", node.kind.replaceAll("_", " ")],
      ["Degrés entrant / sortant", `${indegree.get(node.id)} / ${outdegree.get(node.id)}`],
      ["Transposition", indegree.get(node.id) > 1 ? "oui" : "non"],
      ...(node.steadyStateId === undefined ? [] : [["Steady State", `#${node.steadyStateId}`]]),
    ].map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join("");
    elements.continueFromNode.disabled = false;
    const outcome = navigation?.outcomeAnalyzer.graphNode(node.id);
    if (outcome) renderAnalysis(outcome, node.sideToMove, legalMoves(board));
  }

  navigation = new GameNavigation(graph, {
    onChange: ({ node, board, diagram, status, analysis, mode }) => {
      boardRenderer.setPosition(board, diagram);
      elements.status.textContent = status;
      renderAnalysis(analysis, board.ply % 2 === 0 ? RED : YELLOW, legalMoves(board));
      updateMode(mode);
      if (node) graphRenderer.select(node.id, { center: true, notify: false });
    },
  });
  elements.reset.addEventListener("click", () => navigation.reset());
  elements.modeWeakc4.addEventListener("click", () => navigation.setMode("weakc4"));
  elements.modeTwoPlayer.addEventListener("click", () => navigation.setMode("two-player"));
  elements.continueFromNode.addEventListener("click", () => navigation.continueFromNode(selectedNodeId));
  elements.center.addEventListener("click", () => {
    graphRenderer.centerOn(graphRenderer.selectedId);
    graphRenderer.render();
  });
  showNode(navigation.node);
  graphRenderer.render();
  return { graphRenderer, boardRenderer, navigation };
}
