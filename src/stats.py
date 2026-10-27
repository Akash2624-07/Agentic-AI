"""Drift statistics."""

from __future__ import annotations

import numpy as np
from scipy.stats import ks_2samp

from .config import CATEGORICAL_WEATHER, PSI_BINS, PSI_EPS

WEATHERSIT_LEVELS = (1, 2, 3, 4)


def _psi(ref_p: np.ndarray, cur_p: np.ndarray) -> float:
    ref_p, cur_p = ref_p + PSI_EPS, cur_p + PSI_EPS
    return float(np.sum((cur_p - ref_p) * np.log(cur_p / ref_p)))


def psi_numeric(ref: np.ndarray, cur: np.ndarray) -> float:
    """PSI over the reference's deciles (bins closed on the right edge)."""
    inner = np.quantile(ref, np.linspace(0, 1, PSI_BINS + 1)[1:-1])
    ref_p = np.bincount(np.searchsorted(inner, ref, side="right"), minlength=PSI_BINS) / len(ref)
    cur_p = np.bincount(np.searchsorted(inner, cur, side="right"), minlength=PSI_BINS) / len(cur)
    return _psi(ref_p, cur_p)


def psi_categorical(ref: np.ndarray, cur: np.ndarray, levels=WEATHERSIT_LEVELS) -> float:
    ref_p = np.array([np.mean(ref == k) for k in levels])
    cur_p = np.array([np.mean(cur == k) for k in levels])
    return _psi(ref_p, cur_p)


def psi(feature: str, ref: np.ndarray, cur: np.ndarray) -> float:
    if feature in CATEGORICAL_WEATHER:
        return psi_categorical(ref, cur)
    return psi_numeric(ref, cur)


def ks_pvalue(ref: np.ndarray, cur: np.ndarray) -> float:
    return float(ks_2samp(ref, cur).pvalue)


def sig(x: float | None, digits: int = 3) -> float | None:
    """Round to significant digits (p-values span hundreds of orders of magnitude)."""
    if x is None or x == 0 or not np.isfinite(x):
        return x
    return float(f"{x:.{digits}g}")
