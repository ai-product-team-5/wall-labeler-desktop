from __future__ import annotations

import cv2
import numpy as np

from worker.io_utils import imwrite_unicode


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
