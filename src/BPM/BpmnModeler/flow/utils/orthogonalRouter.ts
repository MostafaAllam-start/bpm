import { Position } from "@xyflow/react";

// An in-house obstacle-avoiding orthogonal edge router. Given a source and
// target rect, the border points the edge attaches to (from getEdgeParams), and
// every other node as an obstacle, it produces a right-angle polyline that does
// not run across any obstacle's (margin-inflated) box, minimising length and
// then turns.
//
// Approach: a *sparse Hanan grid* — candidate grid lines drawn only at obstacle
// edges plus the endpoint/stub coordinates — searched with A*. For N nearby
// obstacles that's O(N) lines per axis and O(N²) vertices, which A* clears in
// well under a millisecond for the handful of obstacles a real diagram puts
// between any two nodes. A uniform pixel grid fine enough to thread the gaps
// would be orders of magnitude larger, so it's deliberately avoided.
//
// The function is pure (rects in → waypoints out) with no React/store coupling,
// so it's unit-testable in isolation (see orthogonalRouter.test.ts).

export type Rect = { x: number; y: number; width: number; height: number };
export type RoutePoint = { x: number; y: number };
export type RouteEndpoint = { x: number; y: number; side: Position };

export type RouteInput = {
  source: Rect;
  target: Rect;
  // Every *other* node — the caller excludes source & target.
  obstacles: Rect[];
  // Border attach points + the side they sit on (from getEdgeParams).
  start: RouteEndpoint;
  end: RouteEndpoint;
  // Clearance kept around obstacles and used for the exit/entry stubs.
  margin?: number;
};

export type RouteResult = {
  // The polyline including the true border endpoints; ≥ 2 points when ok.
  points: RoutePoint[];
  // Midpoint of the polyline by arc length, for the edge label.
  labelX: number;
  labelY: number;
  // false → no clean path found; the caller should fall back to a simple edge.
  ok: boolean;
};

const DEFAULT_MARGIN = 12;
// Added to a path's cost per corner so that, among equal-length routes, the one
// with fewer bends wins.
const TURN_PENALTY = 30;
// Coordinates within this many px are treated as the same grid line / point.
const EPS = 0.5;

// Grow a rect by `m` on every side.
export function inflate(r: Rect, m: number): Rect {
  return { x: r.x - m, y: r.y - m, width: r.width + 2 * m, height: r.height + 2 * m };
}

// Whether the axis-aligned segment a→b passes through the *open interior* of
// `r`. Running along a boundary edge (or merely touching a corner) does not
// count — that's exactly how a path is allowed to hug an inflated obstacle.
export function segmentHitsRect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: Rect,
): boolean {
  const left = r.x;
  const right = r.x + r.width;
  const top = r.y;
  const bottom = r.y + r.height;
  if (Math.abs(ay - by) < EPS) {
    // Horizontal segment.
    const y = ay;
    if (y <= top || y >= bottom) return false;
    const x1 = Math.min(ax, bx);
    const x2 = Math.max(ax, bx);
    return Math.max(x1, left) < Math.min(x2, right);
  }
  if (Math.abs(ax - bx) < EPS) {
    // Vertical segment.
    const x = ax;
    if (x <= left || x >= right) return false;
    const y1 = Math.min(ay, by);
    const y2 = Math.max(ay, by);
    return Math.max(y1, top) < Math.min(y2, bottom);
  }
  // Diagonal (not produced by this router) — conservative bbox overlap.
  const x1 = Math.min(ax, bx);
  const x2 = Math.max(ax, bx);
  const y1 = Math.min(ay, by);
  const y2 = Math.max(ay, by);
  return Math.max(x1, left) < Math.min(x2, right) && Math.max(y1, top) < Math.min(y2, bottom);
}

// The point a stub reaches after stepping `margin` away from a node's border
// along the side the edge attaches to (so the path exits/enters cleanly).
function stubOf(p: RouteEndpoint, margin: number): RoutePoint {
  switch (p.side) {
    case Position.Right:
      return { x: p.x + margin, y: p.y };
    case Position.Left:
      return { x: p.x - margin, y: p.y };
    case Position.Bottom:
      return { x: p.x, y: p.y + margin };
    case Position.Top:
    default:
      return { x: p.x, y: p.y - margin };
  }
}

function dedupeSorted(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (out.length === 0 || v - out[out.length - 1] > EPS) out.push(v);
  }
  return out;
}

// The candidate orthogonal grid lines: one per distinct endpoint/stub coord and
// per obstacle edge.
export function buildHananGrid(
  points: RoutePoint[],
  obstacles: Rect[],
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of points) {
    xs.push(p.x);
    ys.push(p.y);
  }
  for (const r of obstacles) {
    xs.push(r.x, r.x + r.width);
    ys.push(r.y, r.y + r.height);
  }
  return { xs: dedupeSorted(xs), ys: dedupeSorted(ys) };
}

// Index of the grid coord nearest `val` (the coords were seeded from the exact
// stub/endpoint values, so this lands on them despite float dedupe).
function nearestIndex(arr: number[], val: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < arr.length; i++) {
    const dist = Math.abs(arr[i] - val);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

// A minimal binary min-heap keyed by priority (no decrease-key; stale entries
// are skipped via the closed set in the search).
class MinHeap {
  private items: { key: number; priority: number }[] = [];

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  push(key: number, priority: number): void {
    const items = this.items;
    items.push({ key, priority });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].priority <= items[i].priority) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop(): { key: number; priority: number } {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      const n = items.length;
      for (;;) {
        let smallest = i;
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        if (l < n && items[l].priority < items[smallest].priority) smallest = l;
        if (r < n && items[r].priority < items[smallest].priority) smallest = r;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

// A* over grid intersections from (si,sj) to (ti,tj). State = vertex + incoming
// direction (0 none, 1 horizontal, 2 vertical) so turns can be penalised.
// Returns the list of [i,j] grid coords, or null when boxed in.
function search(
  xs: number[],
  ys: number[],
  obstacles: Rect[],
  si: number,
  sj: number,
  ti: number,
  tj: number,
): [number, number][] | null {
  const nx = xs.length;
  const ny = ys.length;
  const encode = (i: number, j: number, d: number): number => (i * ny + j) * 3 + d;
  const decode = (key: number): [number, number, number] => {
    const d = key % 3;
    const v = (key - d) / 3;
    const j = v % ny;
    const i = (v - j) / ny;
    return [i, j, d];
  };
  const heuristic = (i: number, j: number): number =>
    Math.abs(xs[i] - xs[ti]) + Math.abs(ys[j] - ys[tj]);

  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const closed = new Set<number>();
  const heap = new MinHeap();

  const startKey = encode(si, sj, 0);
  gScore.set(startKey, 0);
  heap.push(startKey, heuristic(si, sj));

  while (!heap.isEmpty()) {
    const cur = heap.pop();
    if (closed.has(cur.key)) continue;
    closed.add(cur.key);
    const [i, j, d] = decode(cur.key);
    if (i === ti && j === tj) {
      // Reconstruct the [i,j] chain.
      const chain: [number, number][] = [];
      let k: number | undefined = cur.key;
      while (k !== undefined) {
        const [ci, cj] = decode(k);
        chain.push([ci, cj]);
        k = cameFrom.get(k);
      }
      chain.reverse();
      return chain;
    }
    const g = gScore.get(cur.key)!;
    const moves: [number, number, number][] = [
      [i + 1, j, 1],
      [i - 1, j, 1],
      [i, j + 1, 2],
      [i, j - 1, 2],
    ];
    for (const [ni, nj, nd] of moves) {
      if (ni < 0 || ni >= nx || nj < 0 || nj >= ny) continue;
      if (segmentBlocked(xs[i], ys[j], xs[ni], ys[nj], obstacles)) continue;
      const segLen = Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]);
      const turn = d !== 0 && d !== nd ? TURN_PENALTY : 0;
      const tentative = g + segLen + turn;
      const nKey = encode(ni, nj, nd);
      if (tentative < (gScore.get(nKey) ?? Infinity)) {
        gScore.set(nKey, tentative);
        cameFrom.set(nKey, cur.key);
        heap.push(nKey, tentative + heuristic(ni, nj));
      }
    }
  }
  return null;
}

function segmentBlocked(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  obstacles: Rect[],
): boolean {
  for (const r of obstacles) {
    if (segmentHitsRect(ax, ay, bx, by, r)) return true;
  }
  return false;
}

// Drop interior points that lie on a straight run (and exact duplicates), so the
// polyline keeps only its real corners.
export function simplifyColinear(points: RoutePoint[]): RoutePoint[] {
  if (points.length <= 2) return points.slice();
  const out: RoutePoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1];
    const b = points[i];
    const c = points[i + 1];
    if (Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS) continue; // duplicate
    const sameXrun = Math.abs(a.x - b.x) < EPS && Math.abs(b.x - c.x) < EPS;
    const sameYrun = Math.abs(a.y - b.y) < EPS && Math.abs(b.y - c.y) < EPS;
    if (sameXrun || sameYrun) continue; // redundant mid-run point
    out.push(b);
  }
  const last = points[points.length - 1];
  const tail = out[out.length - 1];
  if (!(Math.abs(tail.x - last.x) < EPS && Math.abs(tail.y - last.y) < EPS)) out.push(last);
  return out;
}

function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

// Serialise a polyline as an SVG path of hard right-angle segments (matching the
// look of getSmoothStepPath with borderRadius 0).
export function pointsToSvgPath(points: RoutePoint[]): string {
  if (points.length === 0) return "";
  let d = `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${fmt(points[i].x)} ${fmt(points[i].y)}`;
  }
  return d;
}

export function labelPoint(points: RoutePoint[]): { labelX: number; labelY: number } {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
  }
  let half = total / 2;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (half <= seg) {
      const tt = seg === 0 ? 0 : half / seg;
      return { labelX: a.x + (b.x - a.x) * tt, labelY: a.y + (b.y - a.y) * tt };
    }
    half -= seg;
  }
  const last = points[points.length - 1];
  return { labelX: last.x, labelY: last.y };
}

const FAIL: RouteResult = { points: [], labelX: 0, labelY: 0, ok: false };

export function routeOrthogonal(input: RouteInput): RouteResult {
  const margin = input.margin ?? DEFAULT_MARGIN;
  const { start, end } = input;
  const startStub = stubOf(start, margin);
  const endStub = stubOf(end, margin);

  const inflated = input.obstacles.map((r) => inflate(r, margin));

  // Only obstacles overlapping the endpoint bounding box can be crossed by a
  // direct route; if none do, the simple edge is already clean — signal a
  // fallback so the visuals are unchanged when nothing is in the way.
  const minX = Math.min(start.x, end.x, startStub.x, endStub.x) - margin;
  const maxX = Math.max(start.x, end.x, startStub.x, endStub.x) + margin;
  const minY = Math.min(start.y, end.y, startStub.y, endStub.y) - margin;
  const maxY = Math.max(start.y, end.y, startStub.y, endStub.y) + margin;
  const relevant = inflated.filter(
    (r) => r.x < maxX && r.x + r.width > minX && r.y < maxY && r.y + r.height > minY,
  );
  if (relevant.length === 0) return FAIL;

  const { xs, ys } = buildHananGrid([start, end, startStub, endStub], relevant);
  const si = nearestIndex(xs, startStub.x);
  const sj = nearestIndex(ys, startStub.y);
  const ti = nearestIndex(xs, endStub.x);
  const tj = nearestIndex(ys, endStub.y);

  const chain = search(xs, ys, relevant, si, sj, ti, tj);
  if (!chain) return FAIL;

  const grid: RoutePoint[] = chain.map(([i, j]) => ({ x: xs[i], y: ys[j] }));
  // True border start → stub → … → stub → true border end.
  const raw: RoutePoint[] = [{ x: start.x, y: start.y }, ...grid, { x: end.x, y: end.y }];
  const points = simplifyColinear(raw);
  const { labelX, labelY } = labelPoint(points);
  return { points, labelX, labelY, ok: true };
}

// Whether two points form a diagonal hop (differ on both axes), so a corner must
// be spliced between them to keep the polyline right-angled.
function isDiagonal(a: RoutePoint, b: RoutePoint): boolean {
  return Math.abs(a.x - b.x) > EPS && Math.abs(a.y - b.y) > EPS;
}

// The corner that turns a diagonal hop prev→next into two right-angle segments.
// `horizontalFirst` → the prev→corner leg is horizontal (corner shares prev's y),
// then vertical into next; otherwise vertical first.
function cornerFor(prev: RoutePoint, next: RoutePoint, horizontalFirst: boolean): RoutePoint {
  return horizontalFirst ? { x: next.x, y: prev.y } : { x: prev.x, y: next.y };
}

function exitsHorizontally(side: Position): boolean {
  return side === Position.Left || side === Position.Right;
}

// Turn a polyline that may contain diagonal hops into a strictly right-angled one
// by splicing a single corner into each diagonal segment. Axis-aligned hops are
// left untouched, so a stub the user dragged off a node face keeps its direction
// (we never force a perpendicular exit on an already-orthogonal hop). The first
// hop exits along the source's face axis, the last hop enters along the target's
// face axis, and interior diagonals default to horizontal-first.
export function orthogonalize(
  points: RoutePoint[],
  sourceSide: Position,
  targetSide: Position,
): RoutePoint[] {
  if (points.length < 2) return points.slice();
  const out: RoutePoint[] = [points[0]];
  const lastSeg = points.length - 2;
  for (let i = 0; i < points.length - 1; i++) {
    const prev = points[i];
    const next = points[i + 1];
    if (isDiagonal(prev, next)) {
      let horizontalFirst: boolean;
      if (i === 0) horizontalFirst = exitsHorizontally(sourceSide);
      else if (i === lastSeg) horizontalFirst = !exitsHorizontally(targetSide);
      else horizontalFirst = true;
      out.push(cornerFor(prev, next, horizontalFirst));
    }
    out.push(next);
  }
  return out;
}

// Build a route through user-authored interior waypoints. Unlike routeOrthogonal
// this ignores obstacles — it threads exactly where the user placed the corners —
// but still guarantees right angles: the anchor→first and last→anchor hops are
// orthogonalised against the node face, then collinear points are dropped.
export function routeManual(
  start: RoutePoint,
  end: RoutePoint,
  waypoints: RoutePoint[],
  sourceSide: Position,
  targetSide: Position,
): RouteResult {
  const raw: RoutePoint[] = [start, ...waypoints, end];
  const points = simplifyColinear(orthogonalize(raw, sourceSide, targetSide));
  const { labelX, labelY } = labelPoint(points);
  return { points, labelX, labelY, ok: true };
}
