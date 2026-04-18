from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class CandidatePoint:
    x: float
    y: float
    score: float
    source: str
