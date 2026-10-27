"""The demand model and everything calibrated when a version is trained.

A ``ModelVersion`` carries, next to the estimator, what the monitor needs to judge
weeks against that version: its training window as a drift reference, per-feature PSI
thresholds, the calendar values it has seen, its baseline error and which features
matter to it.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.inspection import permutation_importance

from . import config, data
from .config import CALENDAR, FEATURES, NORMALISED, TARGET, WEATHER
from .stats import psi


def fit(frame: pd.DataFrame) -> HistGradientBoostingRegressor:
    model = HistGradientBoostingRegressor(**config.MODEL_PARAMS)
    model.fit(frame[FEATURES], frame[TARGET])
    return model


def errors(y: np.ndarray, pred: np.ndarray) -> tuple[float, float]:
    """MAE and WAPE (total absolute error / total demand)."""
    abs_err = np.abs(np.asarray(y, dtype=float) - pred)
    return float(abs_err.mean()), float(abs_err.sum() / np.sum(y))


@dataclass
class ModelVersion:
    version: int
    parent: int | None
    created_week: int
    train_weeks: list[int]
    n_rows: int
    trained_on_faulty: bool
    estimator: HistGradientBoostingRegressor
    reference: dict[str, np.ndarray]
    seen: dict[str, set]
    ref_std: dict[str, float]
    thresholds: dict[str, float]
    baseline_mae: float | None
    baseline_wape: float | None
    importance: dict[str, float]
    status: str = "challenger"
    promoted_week: int | None = None
    # The champion this version replaced when it was promoted (its shadow).
    previous: int | None = None
    _pred: dict[int, np.ndarray] = field(default_factory=dict, repr=False)

    @property
    def span(self) -> str:
        return f"{min(self.train_weeks)}..{max(self.train_weeks)}"

    @property
    def share(self) -> dict[str, float]:
        pos = {f: max(v, 0.0) for f, v in self.importance.items()}
        total = sum(pos.values())
        return {f: (v / total if total > 0 else 0.0) for f, v in pos.items()}

    @property
    def important_features(self) -> list[str]:
        share = self.share
        ranked = sorted(FEATURES, key=lambda f: -share[f])
        return [f for f in ranked if share[f] >= config.IMPORTANT_SHARE]

    def predict_week(self, week: int) -> np.ndarray:
        if week not in self._pred:
            self._pred[week] = self.estimator.predict(data.week(week)[FEATURES])
        return self._pred[week]

    def errors_on(self, week: int) -> tuple[float, float]:
        return errors(data.week(week)[TARGET].values, self.predict_week(week))

    def info(self) -> dict:
        return {
            "version": self.version,
            "status": self.status,
            "parent": self.parent,
            "created_week": self.created_week,
            "train_weeks": [min(self.train_weeks), max(self.train_weeks)],
            "n_rows": self.n_rows,
            "baseline_mae": _r(self.baseline_mae, 2),
            "baseline_wape": _r(self.baseline_wape, 4),
            "promoted_week": self.promoted_week,
            "important_features": self.important_features,
        }


def _r(v: float | None, nd: int) -> float | None:
    return None if v is None else round(v, nd)


def calibrate_thresholds(frame: pd.DataFrame) -> dict[str, float]:
    """PSI threshold per weather feature from the training window's own week-to-week noise.

    Hourly weather is autocorrelated, so a single week rarely looks like the whole
    window: a textbook PSI > 0.2 fires every week. Instead each training week is scored
    against the full window and a feature drifts only when a new week looks more
    different than the noisiest training week did, with some headroom.
    """
    out = {}
    for f in WEATHER:
        ref = frame[f].dropna().values
        scores = [
            psi(f, ref, wk[f].dropna().values)
            for _, wk in frame.groupby("week")
            if wk[f].notna().any()
        ]
        out[f] = round(config.PSI_HEADROOM * max(scores), 3) if scores else float("inf")
    return out


def backtest(frame: pd.DataFrame) -> tuple[float | None, float | None, dict[str, float]]:
    """Baseline error and feature importance, both measured one week ahead.

    For each of the last ``BASELINE_WEEKS`` weeks of the window the recipe is refit on
    the weeks before it and scored on it. The mean of those errors is the error the
    model should be expected to make on a new week. Importance is the MAE increase when
    a feature is shuffled, on the last week, for the model that didn't see that week.
    """
    weeks = sorted(set(frame["week"]))
    maes, wapes, imp = [], [], {f: 0.0 for f in FEATURES}
    for w in weeks[-config.BASELINE_WEEKS:]:
        head, tail = frame[frame["week"] < w], frame[frame["week"] == w]
        if head.empty:
            continue
        estimator = fit(head)
        mae, wape = errors(tail[TARGET].values, estimator.predict(tail[FEATURES]))
        maes.append(mae)
        wapes.append(wape)
        if w == weeks[-1]:
            result = permutation_importance(
                estimator, tail[FEATURES], tail[TARGET], scoring="neg_mean_absolute_error",
                n_repeats=5, random_state=0,
            )
            imp = {f: float(v) for f, v in zip(FEATURES, result.importances_mean)}
    if not maes:
        return None, None, imp
    return float(np.mean(maes)), float(np.mean(wapes)), imp


def _cache_path(train_weeks: tuple[int, ...]) -> Path:
    settings = (train_weeks, config.MODEL_PARAMS, config.PSI_HEADROOM, config.PSI_BINS,
                config.PSI_EPS, config.BASELINE_WEEKS, [f.kind for f in config.FAULTS])
    digest = hashlib.sha1(json.dumps(settings, sort_keys=True).encode()).hexdigest()[:16]
    return config.MODEL_CACHE_DIR / f"{digest}.joblib"


@lru_cache(maxsize=512)
def _fitted(train_weeks: tuple[int, ...]) -> dict:
    """Everything that depends only on the training weeks.

    Training is deterministic, so runs and live sessions that train on the same window
    share one fit, kept in memory and on disk.
    """
    path = _cache_path(train_weeks)
    if path.exists():
        try:
            return {**joblib.load(path), "_pred": {}}
        except Exception:
            path.unlink(missing_ok=True)
    fitted = _fit_window(train_weeks)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({k: v for k, v in fitted.items() if k != "_pred"}, path)
    except OSError:
        pass
    return fitted


def _fit_window(train_weeks: tuple[int, ...]) -> dict:
    frame = data.weeks(train_weeks)
    b_mae, b_wape, imp = backtest(frame)
    return {
        "train_weeks": sorted(int(w) for w in set(frame["week"])),
        "n_rows": int(len(frame)),
        "trained_on_faulty": any(config.faults_in(w) for w in set(frame["week"])),
        "estimator": fit(frame),
        "reference": {f: frame[f].dropna().values for f in WEATHER},
        "seen": {f: set(frame[f].dropna().unique().tolist()) for f in CALENDAR},
        "ref_std": {f: float(frame[f].std()) for f in NORMALISED},
        "thresholds": calibrate_thresholds(frame),
        "baseline_mae": b_mae,
        "baseline_wape": b_wape,
        "importance": imp,
        "_pred": {},
    }


def train(
    version: int, train_weeks: list[int], created_week: int, parent: int | None = None
) -> ModelVersion:
    return ModelVersion(
        version=version,
        parent=parent,
        created_week=created_week,
        **_fitted(tuple(sorted(train_weeks))),
    )
