import { boardFromMoves, boardKey } from "../game/board.js";
import { mirrorBoard } from "../game/symmetry.js";

export function parseOriginalPositions(text) {
  const positions = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const [moves, rawX, rawY, rawZ] = rawLine.split(",");
    const point = { x: Number(rawX), y: Number(rawY), z: Number(rawZ) };
    if (![point.x, point.y, point.z].every(Number.isFinite)) throw new Error(`invalid layout line: ${rawLine}`);
    positions.set(boardKey(boardFromMoves(moves)), point);
  }
  return positions;
}

export function weakC4OriginalLayout(graph, text) {
  const source = parseOriginalPositions(text);
  const layout = new Map();
  for (const node of graph.nodes) {
    let point = source.get(node.boardKey);
    if (!point) {
      const board = Object.freeze({
        redMask: BigInt(`0x${node.redMask}`),
        yellowMask: BigInt(`0x${node.yellowMask}`),
        ply: node.ply,
      });
      const mirrored = source.get(boardKey(mirrorBoard(board)));
      if (mirrored) point = { x: -mirrored.x, y: mirrored.y, z: mirrored.z };
    }
    if (!point) point = fallbackPoint(node);
    layout.set(node.id, point);
  }
  layout.set(graph.metadata.rootId, { x: 0, y: 0, z: 0 });
  return layout;
}

function fallbackPoint(node) {
  const hash = [...node.boardKey].reduce((value, ch) => (value * 33 + ch.charCodeAt(0)) >>> 0, 5381);
  const angle = (hash / 0xffffffff) * Math.PI * 2;
  return { x: Math.cos(angle) * (8 + node.ply), y: -node.ply * 8, z: Math.sin(angle) * (8 + node.ply) };
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Deterministic offline force layout. Coordinates are never graph identity. */
export class ForceDirectedLayout {
  constructor({ seed = 4, depthSpacing = 12, epsilon = 0.01 } = {}) {
    this.seed = seed;
    this.depthSpacing = depthSpacing;
    this.epsilon = epsilon;
    this.points = new Map();
    this.velocities = new Map();
    this.graph = null;
  }

  initialize(graph) {
    this.graph = graph;
    const random = seededRandom(this.seed);
    for (const node of graph.nodes) {
      this.points.set(node.id, node.id === graph.metadata.rootId
        ? { x: 0, y: 0, z: 0 }
        : { x: (random() - 0.5) * 80, y: -node.ply * this.depthSpacing, z: (random() - 0.5) * 80 });
      this.velocities.set(node.id, { x: 0, y: 0, z: 0 });
    }
  }

  iterate(dt = 0.02) {
    if (!this.graph) throw new Error("layout must be initialized first");
    const nodes = this.graph.nodes;
    const forces = new Map(nodes.map((node) => [node.id, { x: 0, y: 0, z: 0 }]));
    // Deterministic sampling bounds large graphs while retaining a repulsive field.
    const stride = Math.max(1, Math.floor(nodes.length / 96));
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      const pa = this.points.get(a.id);
      for (let offset = stride; offset < nodes.length; offset += stride) {
        const j = (i + offset) % nodes.length;
        if (j <= i) continue;
        const b = nodes[j];
        const pb = this.points.get(b.id);
        const dx = pa.x - pb.x || 0.01;
        const dy = pa.y - pb.y || 0.01;
        const dz = pa.z - pb.z || 0.01;
        const distance2 = Math.max(1, dx * dx + dy * dy + dz * dz);
        const scale = 90 / distance2;
        const fa = forces.get(a.id);
        const fb = forces.get(b.id);
        fa.x += dx * scale; fa.y += dy * scale; fa.z += dz * scale;
        fb.x -= dx * scale; fb.y -= dy * scale; fb.z -= dz * scale;
      }
    }
    for (const edge of this.graph.edges) {
      const source = this.points.get(edge.source);
      const target = this.points.get(edge.target);
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dz = target.z - source.z;
      const distance = Math.hypot(dx, dy, dz) || 1;
      const scale = (distance - this.depthSpacing) * 0.035 / distance;
      const fs = forces.get(edge.source);
      const ft = forces.get(edge.target);
      fs.x += dx * scale; fs.y += dy * scale; fs.z += dz * scale;
      ft.x -= dx * scale; ft.y -= dy * scale; ft.z -= dz * scale;
    }
    let maxDisplacement = 0;
    for (const node of nodes) {
      if (node.id === this.graph.metadata.rootId) continue;
      const point = this.points.get(node.id);
      const velocity = this.velocities.get(node.id);
      const force = forces.get(node.id);
      force.y += (-node.ply * this.depthSpacing - point.y) * 0.08;
      velocity.x = (velocity.x + force.x * dt) * 0.86;
      velocity.y = (velocity.y + force.y * dt) * 0.86;
      velocity.z = (velocity.z + force.z * dt) * 0.86;
      point.x += velocity.x; point.y += velocity.y; point.z += velocity.z;
      maxDisplacement = Math.max(maxDisplacement, Math.hypot(velocity.x, velocity.y, velocity.z));
    }
    return maxDisplacement;
  }

  run({ maxIterations = 800, stableIterations = 20 } = {}) {
    let stable = 0;
    let displacement = Infinity;
    let iteration = 0;
    for (; iteration < maxIterations && stable < stableIterations; iteration += 1) {
      const cooling = 1 - iteration / maxIterations;
      displacement = this.iterate(Math.max(0.00001, 0.02 * cooling * cooling));
      stable = displacement < this.epsilon ? stable + 1 : 0;
    }
    return { iterations: iteration, maxDisplacement: displacement, converged: stable >= stableIterations };
  }

  positions() {
    return new Map([...this.points].map(([id, point]) => [id, { ...point }]));
  }
}
