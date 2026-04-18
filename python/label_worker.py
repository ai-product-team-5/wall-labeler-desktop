from __future__ import annotations

import argparse
import json
import math
import os
import sys
from dataclasses import dataclass
from typing import Iterable, Sequence

import cv2
import numpy as np


@dataclass
class CandidatePoint:
    x: float
    y: float
    score: float
    source: str


def imread_unicode(path: str) -> np.ndarray:
    data = np.fromfile(path, dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f'无法读取图片: {path}')
    return image


def imwrite_unicode(path: str, image: np.ndarray) -> None:
    ext = os.path.splitext(path)[1] or '.png'
    success, encoded = cv2.imencode(ext, image)
    if not success:
        raise ValueError(f'无法写入图片: {path}')
    encoded.tofile(path)


def preprocess(image: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    binary = cv2.adaptiveThreshold(
        blur,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        31,
        9,
    )
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    clean = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
    clean = cv2.morphologyEx(clean, cv2.MORPH_CLOSE, kernel, iterations=1)
    edges = cv2.Canny(clean, 50, 150)
    return gray, clean, edges


def contour_candidates(binary: np.ndarray) -> list[CandidatePoint]:
    height, width = binary.shape[:2]
    area_min = max(80, int(height * width * 0.00003))
    contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    candidates: list[CandidatePoint] = []

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < area_min:
            continue
        perimeter = cv2.arcLength(contour, True)
        if perimeter < max(height, width) * 0.025:
            continue

        epsilon = max(2.0, 0.01 * perimeter)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        points = approx.reshape(-1, 2)
        if len(points) < 2 or len(points) > 40:
            continue

        score = 1.4 + min(area / max(height * width * 0.01, 1), 2.5)
        for px, py in points:
            candidates.append(
                CandidatePoint(float(px), float(py), score, 'contour')
            )

    return candidates


def extract_segments(edges: np.ndarray) -> list[tuple[float, float, float, float, float, float]]:
    height, width = edges.shape[:2]
    min_dim = min(height, width)
    min_length = max(18, int(min_dim * 0.04))
    max_gap = max(6, int(min_dim * 0.012))
    raw_lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=40,
        minLineLength=min_length,
        maxLineGap=max_gap,
    )

    if raw_lines is None:
        return []

    segments: list[tuple[float, float, float, float, float, float]] = []
    for row in raw_lines:
        x1, y1, x2, y2 = row[0]
        length = math.hypot(x2 - x1, y2 - y1)
        if length < min_length:
            continue
        angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
        segments.append((float(x1), float(y1), float(x2), float(y2), length, angle))

    segments.sort(key=lambda item: item[4], reverse=True)
    return segments[:160]


def segment_endpoint_candidates(segments: Sequence[tuple[float, float, float, float, float, float]]) -> list[CandidatePoint]:
    points: list[CandidatePoint] = []
    for x1, y1, x2, y2, length, _angle in segments:
        score = 1.0 + min(length / 180.0, 2.2)
        points.append(CandidatePoint(x1, y1, score, 'endpoint'))
        points.append(CandidatePoint(x2, y2, score, 'endpoint'))
    return points


def point_to_segment_distance(point: tuple[float, float], segment: tuple[float, float, float, float, float, float]) -> float:
    px, py = point
    x1, y1, x2, y2, _length, _angle = segment
    vx, vy = x2 - x1, y2 - y1
    wx, wy = px - x1, py - y1
    denom = vx * vx + vy * vy
    if denom < 1e-8:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, (wx * vx + wy * vy) / denom))
    proj_x = x1 + t * vx
    proj_y = y1 + t * vy
    return math.hypot(px - proj_x, py - proj_y)


def line_intersection(seg_a, seg_b) -> tuple[float, float] | None:
    x1, y1, x2, y2, _la, _aa = seg_a
    x3, y3, x4, y4, _lb, _ab = seg_b
    denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(denom) < 1e-6:
        return None
    cross1 = x1 * y2 - y1 * x2
    cross2 = x3 * y4 - y3 * x4
    px = (cross1 * (x3 - x4) - (x1 - x2) * cross2) / denom
    py = (cross1 * (y3 - y4) - (y1 - y2) * cross2) / denom
    return (px, py)


def intersection_candidates(
    segments: Sequence[tuple[float, float, float, float, float, float]],
    image_shape: tuple[int, int],
) -> list[CandidatePoint]:
    height, width = image_shape[:2]
    tolerance = max(10.0, min(height, width) * 0.012)
    points: list[CandidatePoint] = []

    segment_count = min(len(segments), 90)
    for index in range(segment_count):
        seg_a = segments[index]
        for j in range(index + 1, segment_count):
            seg_b = segments[j]
            angle_gap = abs(seg_a[5] - seg_b[5]) % 180.0
            angle_gap = min(angle_gap, 180.0 - angle_gap)
            if angle_gap < 25.0 or angle_gap > 155.0:
                continue

            cross = line_intersection(seg_a, seg_b)
            if cross is None:
                continue
            px, py = cross
            if px < -tolerance or py < -tolerance or px > width + tolerance or py > height + tolerance:
                continue
            if point_to_segment_distance(cross, seg_a) > tolerance:
                continue
            if point_to_segment_distance(cross, seg_b) > tolerance:
                continue

            length_score = min((seg_a[4] + seg_b[4]) / 220.0, 3.0)
            points.append(CandidatePoint(px, py, 2.2 + length_score, 'intersection'))

    return points


def cluster_points(candidates: Iterable[CandidatePoint], radius: float, limit: int) -> list[CandidatePoint]:
    clusters: list[dict] = []
    sorted_candidates = sorted(candidates, key=lambda item: item.score, reverse=True)

    for point in sorted_candidates:
        best_cluster = None
        best_distance = radius
        for cluster in clusters:
            dist = math.hypot(point.x - cluster['x'], point.y - cluster['y'])
            if dist <= best_distance:
                best_distance = dist
                best_cluster = cluster

        if best_cluster is None:
            clusters.append(
                {
                    'x': point.x,
                    'y': point.y,
                    'weight': point.score,
                    'score': point.score,
                    'sources': {point.source},
                }
            )
            continue

        weight = best_cluster['weight'] + point.score
        best_cluster['x'] = (best_cluster['x'] * best_cluster['weight'] + point.x * point.score) / weight
        best_cluster['y'] = (best_cluster['y'] * best_cluster['weight'] + point.y * point.score) / weight
        best_cluster['weight'] = weight
        best_cluster['score'] += point.score
        best_cluster['sources'].add(point.source)

    clusters.sort(key=lambda item: item['score'], reverse=True)
    output: list[CandidatePoint] = []
    for cluster in clusters[:limit]:
        output.append(
            CandidatePoint(
                x=float(round(cluster['x'], 2)),
                y=float(round(cluster['y'], 2)),
                score=float(round(cluster['score'], 2)),
                source='+'.join(sorted(cluster['sources'])),
            )
        )
    return output


def detect_corners(image_path: str, max_corners: int) -> dict:
    image = imread_unicode(image_path)
    _gray, binary, edges = preprocess(image)
    height, width = image.shape[:2]

    contour_points = contour_candidates(binary)
    segments = extract_segments(edges)
    endpoint_points = segment_endpoint_candidates(segments)
    cross_points = intersection_candidates(segments, (height, width))

    cluster_radius = max(6.0, min(height, width) * 0.008)
    merged = cluster_points(
        [*contour_points, *endpoint_points, *cross_points],
        radius=cluster_radius,
        limit=max_corners,
    )

    corners = [
        {
            'id': f'corner_{index + 1}',
            'x': point.x,
            'y': point.y,
            'score': point.score,
            'source': point.source,
        }
        for index, point in enumerate(merged)
    ]

    return {
        'corners': corners,
        'stats': {
            'contourCandidates': len(contour_points),
            'lineSegments': len(segments),
            'intersections': len(cross_points),
            'clustered': len(corners),
        },
    }


def export_mask(project: dict, output_path: str) -> dict:
    image_meta = project.get('image') or {}
    width = int(image_meta.get('width', 0))
    height = int(image_meta.get('height', 0))
    if width <= 0 or height <= 0:
        raise ValueError('项目中缺少合法的 image.width / image.height')

    mask = np.zeros((height, width), dtype=np.uint8)
    walls = project.get('walls') or []
    default_width = int((project.get('settings') or {}).get('defaultWallWidthPx', 4))

    for wall in walls:
        points = wall.get('points') or []
        if len(points) < 2:
            continue
        thickness = max(1, int(round(wall.get('widthPx', default_width))))
        polyline = np.array(
            [[int(round(point['x'])), int(round(point['y']))] for point in points],
            dtype=np.int32,
        )
        cv2.polylines(mask, [polyline], False, 255, thickness=thickness, lineType=cv2.LINE_8)
        cap_radius = max(1, int(round(thickness / 2)))
        for px, py in polyline:
            cv2.circle(mask, (int(px), int(py)), cap_radius, 255, thickness=-1, lineType=cv2.LINE_8)

    imwrite_unicode(output_path, mask)
    return {
        'wallCount': len(walls),
    }


def read_project_from_stdin() -> dict:
    raw = sys.stdin.read().strip()
    if not raw:
        raise ValueError('stdin 为空，无法导出 mask')
    return json.loads(raw)


def main() -> int:
    parser = argparse.ArgumentParser(description='Wall Label worker')
    subparsers = parser.add_subparsers(dest='command', required=True)

    detect_parser = subparsers.add_parser('detect-corners', help='detect snap corners')
    detect_parser.add_argument('--image', required=True)
    detect_parser.add_argument('--max-corners', type=int, default=800)

    export_parser = subparsers.add_parser('export-mask', help='export wall mask')
    export_parser.add_argument('--output', required=True)

    args = parser.parse_args()

    try:
        if args.command == 'detect-corners':
            result = detect_corners(args.image, args.max_corners)
        elif args.command == 'export-mask':
            project = read_project_from_stdin()
            result = export_mask(project, args.output)
        else:
            raise ValueError(f'未知命令: {args.command}')
    except Exception as exc:  # noqa: BLE001
        print(str(exc), file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
