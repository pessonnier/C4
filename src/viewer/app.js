import { mountViewer } from "./interaction.js";

const response = await fetch("./dist/graph.json");
if (!response.ok) throw new Error(`Unable to load graph.json (${response.status})`);
const graph = await response.json();

mountViewer(graph, {
  graph: document.querySelector("#graph"),
  board: document.querySelector("#board"),
  details: document.querySelector("#details"),
  status: document.querySelector("#status"),
  reset: document.querySelector("#reset"),
  center: document.querySelector("#center"),
  modeWeakc4: document.querySelector("#mode-weakc4"),
  modeTwoPlayer: document.querySelector("#mode-two-player"),
  playHint: document.querySelector("#play-hint"),
  continueFromNode: document.querySelector("#continue-from-node"),
  redWins: document.querySelector("#red-wins"),
  yellowWins: document.querySelector("#yellow-wins"),
  draws: document.querySelector("#draws"),
  columnAnalysis: document.querySelector("#column-analysis"),
  analysisBasis: document.querySelector("#analysis-basis"),
  analysisPerspective: document.querySelector("#analysis-perspective"),
});

document.querySelector("#loading").hidden = true;
