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
