const COLORS = {
  RED_DECISION: "#ff5f68",
  YELLOW_REPLY: "#ffd447",
  STEADY_STATE: "#55dfb2",
};

export class GraphRenderer {
  constructor(canvas, graph, { onSelect = () => {} } = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.graph = graph;
    this.onSelect = onSelect;
    this.nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    this.positions = graph.layout ?? {};
    this.outgoing = new Map(graph.nodes.map((node) => [node.id, []]));
    graph.edges.forEach((edge) => this.outgoing.get(edge.source)?.push(edge));
    this.yaw = -0.45;
    this.pitch = -0.35;
    this.zoom = 4;
    this.panX = 0;
    this.panY = 0;
    this.selectedId = graph.metadata.rootId;
    this.reachable = this.computeReachable(this.selectedId);
    this.projected = [];
    this.drag = null;
    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(canvas);
  }

  bindEvents() {
    this.canvas.addEventListener("pointerdown", (event) => {
      this.drag = { x: event.clientX, y: event.clientY, moved: false };
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.drag) return;
      const dx = event.clientX - this.drag.x;
      const dy = event.clientY - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.drag.moved = true;
      this.yaw += dx * 0.006;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch + dy * 0.006));
      this.drag.x = event.clientX;
      this.drag.y = event.clientY;
      this.render();
    });
    this.canvas.addEventListener("pointerup", (event) => {
      if (this.drag && !this.drag.moved) this.pick(event);
      this.drag = null;
    });
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.zoom = Math.max(0.5, Math.min(20, this.zoom * Math.exp(-event.deltaY * 0.001)));
      this.render();
    }, { passive: false });
  }

  computeReachable(startId) {
    const reachable = new Set([startId]);
    const queue = [startId];
    while (queue.length) {
      const id = queue.shift();
      for (const edge of this.outgoing.get(id) ?? []) {
        if (!reachable.has(edge.target)) {
          reachable.add(edge.target);
          queue.push(edge.target);
        }
      }
    }
    return reachable;
  }

  select(nodeId, { center = false, notify = true } = {}) {
    if (!this.nodes.has(nodeId)) return;
    this.selectedId = nodeId;
    this.reachable = this.computeReachable(nodeId);
    if (center) this.centerOn(nodeId);
    if (notify) this.onSelect(this.nodes.get(nodeId));
    this.render();
  }

  centerOn(nodeId) {
    const point = this.positions[nodeId];
    if (!point) return;
    const projected = this.rotate(point);
    this.panX = -projected.x * this.zoom;
    this.panY = -projected.y * this.zoom;
  }

  rotate(point) {
    const cy = Math.cos(this.yaw); const sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch); const sp = Math.sin(this.pitch);
    const x1 = point.x * cy - point.z * sy;
    const z1 = point.x * sy + point.z * cy;
    return { x: x1, y: point.y * cp - z1 * sp, z: point.y * sp + z1 * cp };
  }

  project(point, width, height) {
    const rotated = this.rotate(point);
    const perspective = Math.max(0.3, 1 + rotated.z / 650);
    return {
      x: width / 2 + this.panX + rotated.x * this.zoom / perspective,
      y: height / 2 + this.panY + rotated.y * this.zoom / perspective,
      z: rotated.z,
      scale: 1 / perspective,
    };
  }

  render() {
    const canvas = this.canvas;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;
    if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
      canvas.width = width * ratio;
      canvas.height = height * ratio;
    }
    const context = this.context;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const projectedById = new Map();
    for (const node of this.graph.nodes) {
      const point = this.positions[node.id] ?? { x: 0, y: -node.ply * 10, z: 0 };
      projectedById.set(node.id, this.project(point, width, height));
    }
    context.lineWidth = 0.75;
    for (const edge of this.graph.edges) {
      const source = projectedById.get(edge.source);
      const target = projectedById.get(edge.target);
      const active = this.reachable.has(edge.source) && this.reachable.has(edge.target);
      context.globalAlpha = active ? 0.55 : 0.055;
      context.strokeStyle = edge.player === "RED" ? "#ff5f68" : "#ffd447";
      context.beginPath();
      context.moveTo(source.x, source.y);
      context.lineTo(target.x, target.y);
      context.stroke();
    }
    this.projected = this.graph.nodes.map((node) => ({ node, ...projectedById.get(node.id) }))
      .sort((left, right) => left.z - right.z);
    for (const point of this.projected) {
      const selected = point.node.id === this.selectedId;
      context.globalAlpha = this.reachable.has(point.node.id) ? 0.9 : 0.11;
      context.fillStyle = COLORS[point.node.kind];
      context.beginPath();
      context.arc(point.x, point.y, selected ? 5.5 : Math.max(1.4, 2.4 * point.scale), 0, Math.PI * 2);
      context.fill();
      if (selected) {
        context.globalAlpha = 1;
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.stroke();
      }
    }
    context.globalAlpha = 1;
  }

  pick(event) {
    const bounds = this.canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    let best = null;
    let bestDistance = 12;
    for (const point of this.projected) {
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance < bestDistance) {
        best = point.node;
        bestDistance = distance;
      }
    }
    if (best) this.select(best.id, { notify: true });
  }
}
