import { describe, expect, it } from "vitest";
import { Position } from "@xyflow/react";

import {
  inflate,
  segmentHitsRect,
  simplifyColinear,
  pointsToSvgPath,
  routeOrthogonal,
  orthogonalize,
  routeManual,
  type Rect,
  type RoutePoint,
} from "./orthogonalRouter.ts";

// Two tasks 400px apart on the same row, attaching right→left (what
// getEdgeParams yields for a left-to-right pair).
const source: Rect = { x: 0, y: 0, width: 100, height: 80 };
const target: Rect = { x: 400, y: 0, width: 100, height: 80 };
const start = { x: 100, y: 40, side: Position.Right } as const;
const end = { x: 400, y: 40, side: Position.Left } as const;

// True when any segment of the polyline passes through the rect's interior.
function anySegmentHits(points: RoutePoint[], r: Rect): boolean {
  for (let i = 1; i < points.length; i++) {
    if (segmentHitsRect(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y, r)) return true;
  }
  return false;
}

// True when every segment is axis-aligned (orthogonal).
function allOrthogonal(points: RoutePoint[]): boolean {
  for (let i = 1; i < points.length; i++) {
    const dx = Math.abs(points[i].x - points[i - 1].x);
    const dy = Math.abs(points[i].y - points[i - 1].y);
    if (dx > 0.5 && dy > 0.5) return false;
  }
  return true;
}

describe("segmentHitsRect", () => {
  const r: Rect = { x: 100, y: 100, width: 100, height: 100 }; // interior (100,200)

  it("detects a horizontal segment crossing the interior", () => {
    expect(segmentHitsRect(50, 150, 250, 150, r)).toBe(true);
  });

  it("ignores a segment running along the boundary edge", () => {
    expect(segmentHitsRect(50, 100, 250, 100, r)).toBe(false); // along the top edge
    expect(segmentHitsRect(50, 200, 250, 200, r)).toBe(false); // along the bottom edge
  });

  it("ignores a segment that misses the rect", () => {
    expect(segmentHitsRect(50, 50, 250, 50, r)).toBe(false);
  });

  it("detects a vertical segment crossing the interior", () => {
    expect(segmentHitsRect(150, 50, 150, 250, r)).toBe(true);
  });
});

describe("inflate", () => {
  it("grows the rect by the margin on every side", () => {
    expect(inflate({ x: 10, y: 20, width: 30, height: 40 }, 5)).toEqual({
      x: 5,
      y: 15,
      width: 40,
      height: 50,
    });
  });
});

describe("routeOrthogonal", () => {
  it("falls back (ok:false) when there are no obstacles", () => {
    const res = routeOrthogonal({ source, target, obstacles: [], start, end });
    expect(res.ok).toBe(false);
  });

  it("falls back (ok:false) when the only obstacle is far from the corridor", () => {
    const far: Rect = { x: 200, y: 600, width: 100, height: 80 };
    const res = routeOrthogonal({ source, target, obstacles: [far], start, end });
    expect(res.ok).toBe(false);
  });

  it("routes around an obstacle sitting directly between the endpoints", () => {
    const between: Rect = { x: 200, y: 0, width: 100, height: 80 };
    const res = routeOrthogonal({ source, target, obstacles: [between], start, end, margin: 12 });

    expect(res.ok).toBe(true);
    // Endpoints are the true node borders.
    expect(res.points[0]).toEqual({ x: 100, y: 40 });
    expect(res.points[res.points.length - 1]).toEqual({ x: 400, y: 40 });
    // It actually detours (more than a straight 2-point line).
    expect(res.points.length).toBeGreaterThan(2);
    // Every leg is orthogonal and none cuts through the inflated obstacle.
    expect(allOrthogonal(res.points)).toBe(true);
    expect(anySegmentHits(res.points, inflate(between, 12))).toBe(false);
    // Label sits on the polyline.
    expect(Number.isFinite(res.labelX)).toBe(true);
    expect(Number.isFinite(res.labelY)).toBe(true);
  });

  it("returns ok:false when the start is boxed in", () => {
    // An obstacle that swallows the exit stub, sealing every first move.
    const cage: Rect = { x: 108, y: -40, width: 240, height: 160 };
    const res = routeOrthogonal({ source, target, obstacles: [cage], start, end });
    expect(res.ok).toBe(false);
  });

  it("is deterministic for identical input", () => {
    const between: Rect = { x: 200, y: 0, width: 100, height: 80 };
    const a = routeOrthogonal({ source, target, obstacles: [between], start, end });
    const b = routeOrthogonal({ source, target, obstacles: [between], start, end });
    expect(a.points).toEqual(b.points);
  });
});

describe("simplifyColinear", () => {
  it("collapses a straight run of points to its endpoints", () => {
    const pts: RoutePoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
    ];
    expect(simplifyColinear(pts)).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
    ]);
  });

  it("drops exact duplicate points", () => {
    const pts: RoutePoint[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 10 },
    ];
    expect(simplifyColinear(pts)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 10 },
    ]);
  });
});

describe("simplifyColinear (anchor stub)", () => {
  it("collapses a redundant corner that lies on the anchor's straight run", () => {
    // A waypoint dragged back onto the source→target line: the middle corner is
    // collinear with its neighbours and must vanish, leaving a straight edge.
    const pts: RoutePoint[] = [
      { x: 100, y: 40 },
      { x: 250, y: 40 },
      { x: 400, y: 40 },
    ];
    expect(simplifyColinear(pts)).toEqual([
      { x: 100, y: 40 },
      { x: 400, y: 40 },
    ]);
  });
});

describe("orthogonalize", () => {
  it("leaves an already right-angled polyline untouched", () => {
    const pts: RoutePoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 80 },
    ];
    expect(orthogonalize(pts, Position.Right, Position.Left)).toEqual(pts);
  });

  it("splices a corner into a diagonal hop and stays orthogonal", () => {
    const pts: RoutePoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 }, // interior waypoint on the source row
      { x: 200, y: 100 }, // target below-right → last hop is diagonal
    ];
    const out = orthogonalize(pts, Position.Right, Position.Left);
    expect(allOrthogonal(out)).toBe(true);
    // Last hop enters a Left face, so the final segment is horizontal.
    const a = out[out.length - 2];
    const b = out[out.length - 1];
    expect(Math.abs(a.y - b.y)).toBeLessThan(0.5);
  });

  it("exits/enters along the node face for every source/target side combo", () => {
    const sides = [Position.Left, Position.Right, Position.Top, Position.Bottom];
    for (const s of sides) {
      for (const t of sides) {
        const pts: RoutePoint[] = [
          { x: 0, y: 0 },
          { x: 70, y: 30 }, // single diagonal interior point
          { x: 200, y: 160 },
        ];
        const out = orthogonalize(pts, s, t);
        expect(allOrthogonal(out)).toBe(true);
        // First/last anchors preserved.
        expect(out[0]).toEqual(pts[0]);
        expect(out[out.length - 1]).toEqual(pts[pts.length - 1]);
      }
    }
  });
});

describe("routeManual", () => {
  it("threads through the waypoints with right angles and a finite label", () => {
    const res = routeManual(
      { x: 100, y: 40 },
      { x: 400, y: 200 },
      [{ x: 250, y: 40 }],
      Position.Right,
      Position.Left,
    );
    expect(res.ok).toBe(true);
    expect(allOrthogonal(res.points)).toBe(true);
    expect(res.points[0]).toEqual({ x: 100, y: 40 });
    expect(res.points[res.points.length - 1]).toEqual({ x: 400, y: 200 });
    expect(Number.isFinite(res.labelX)).toBe(true);
    expect(Number.isFinite(res.labelY)).toBe(true);
  });

  it("collapses a waypoint that sits back on the straight line", () => {
    const res = routeManual(
      { x: 100, y: 40 },
      { x: 400, y: 40 },
      [{ x: 250, y: 40 }],
      Position.Right,
      Position.Left,
    );
    expect(res.points).toEqual([
      { x: 100, y: 40 },
      { x: 400, y: 40 },
    ]);
  });
});

describe("pointsToSvgPath", () => {
  it("emits an M…L… path of right-angle segments", () => {
    const pts: RoutePoint[] = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
    ];
    expect(pointsToSvgPath(pts)).toBe("M 0 0 L 20 0 L 20 10");
  });
});
