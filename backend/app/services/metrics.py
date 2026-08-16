"""Shared telemetry window/statistics helpers used by the scoring engines."""

import statistics
from datetime import datetime, timedelta

from app.models.telemetry import Telemetry

MIN_STD = {
    "temperature": 0.6,
    "charging_duration": 2.0,
    "current": 0.3,
}


def window_slice(rows: list[Telemetry], end: datetime, hours: int, offset_hours: int = 0) -> list[Telemetry]:
    """Rows within (end - offset - hours, end - offset], inclusive of end when offset=0."""
    window_end = end - timedelta(hours=offset_hours)
    window_start = window_end - timedelta(hours=hours)
    return [r for r in rows if window_start < r.timestamp <= window_end]


def mean_std(values: list[float], metric: str) -> tuple[float, float]:
    if not values:
        return 0.0, MIN_STD.get(metric, 1.0)
    mean = statistics.fmean(values)
    std = statistics.pstdev(values) if len(values) > 1 else 0.0
    return mean, max(std, MIN_STD.get(metric, 1.0))


def zscore(current_mean: float, baseline_mean: float, baseline_std: float) -> float:
    return (current_mean - baseline_mean) / baseline_std


def connectivity_fractions(rows: list[Telemetry]) -> tuple[float, float, float]:
    if not rows:
        return 1.0, 0.0, 0.0
    total = len(rows)
    stable = sum(1 for r in rows if r.connectivity_status == "STABLE") / total
    intermittent = sum(1 for r in rows if r.connectivity_status == "INTERMITTENT") / total
    offline = sum(1 for r in rows if r.connectivity_status == "OFFLINE") / total
    return stable, intermittent, offline


def failed_swap_rate(rows: list[Telemetry]) -> float:
    total_swaps = sum(r.swap_count for r in rows)
    total_failed = sum(r.failed_swap_count for r in rows)
    if total_swaps == 0:
        return 0.0
    return total_failed / total_swaps


def error_rate(rows: list[Telemetry]) -> float:
    if not rows:
        return 0.0
    return sum(1 for r in rows if r.error_code) / len(rows)
