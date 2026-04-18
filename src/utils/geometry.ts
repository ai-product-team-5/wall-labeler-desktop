import type { Point, WallPoint } from '@/types/project';

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function flattenPoints(points: Array<Point | WallPoint>) {
  return points.flatMap((point) => [point.x, point.y]);
}

export function roundPoint(point: Point) {
  return {
    x: Math.round(point.x * 100) / 100,
    y: Math.round(point.y * 100) / 100
  };
}

export interface SegmentProjection {
  point: Point;
  distance: number;
  t: number;
}

export interface PolylineProjection extends SegmentProjection {
  segmentIndex: number;
}

export function projectPointToSegment(
  point: Point,
  start: Point,
  end: Point
): SegmentProjection {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const segmentLengthSquared = deltaX * deltaX + deltaY * deltaY;

  if (!segmentLengthSquared) {
    return {
      point: { x: start.x, y: start.y },
      distance: distance(point, start),
      t: 0
    };
  }

  const rawT =
    ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) /
    segmentLengthSquared;
  const t = clamp(rawT, 0, 1);
  const projection = {
    x: start.x + deltaX * t,
    y: start.y + deltaY * t
  };

  return {
    point: projection,
    distance: distance(point, projection),
    t
  };
}

export function projectPointToPolyline(
  point: Point,
  polyline: Array<Point | WallPoint>
): PolylineProjection | null {
  if (polyline.length < 2) {
    return null;
  }

  let nearest: PolylineProjection | null = null;

  for (let index = 0; index < polyline.length - 1; index += 1) {
    const projection = projectPointToSegment(point, polyline[index], polyline[index + 1]);
    if (!nearest || projection.distance < nearest.distance) {
      nearest = {
        ...projection,
        segmentIndex: index
      };
    }
  }

  return nearest;
}
