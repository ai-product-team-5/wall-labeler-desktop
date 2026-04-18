from __future__ import annotations

import json
import os
import sys

import cv2
import numpy as np


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


def read_project_from_stdin() -> dict:
    raw = sys.stdin.read().strip()
    if not raw:
        raise ValueError('stdin 为空，无法导出 mask')
    return json.loads(raw)
