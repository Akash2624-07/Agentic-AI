"""Monitor: what each weekly batch looks like next to the live model's training data.

Inputs are checked as soon as a batch arrives (quality, drift, unseen calendar values,
jumps). Error can only be measured a week later, when the true counts arrive.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

from . import config, data
from .config import CALENDAR, DOMAINS, FEATURES, NORMALISED, THRESHOLDS, WEATHER
from .model import ModelVersion
from .stats import ks_pvalue, psi, sig

ALERT_ORDER = ["quality", "drift", "jump"]
# Order features are listed in diagnoses: weather first, then calendar.
DIAGNOSIS_ORDER = WEATHER + CALENDAR


def _rate(mask: pd.Series) -> float:
    return round(float(mask.mean()), 4) if len(mask) else 0.0


def check_inputs(
    week: int, champion: ModelVersion, last_clean_means: dict[str, float] | None
) -> dict:
    """Per-feature checks of one weekly batch against the champion.

    ``last_clean_means`` are the weather means of the most recent replay week that
    passed quality, the reference for the jump check (None before the first one).
    """
    batch = data.week(week)
    n = len(batch)
    features = []
    exact_means = {}
    for f in FEATURES:
        col = batch[f]
        present = col.dropna()
        lo, hi = DOMAINS[f]
        flags = []
        entry = {
            "feature": f,
            "missing": _rate(col.isna()),
            "out_of_domain": round(float(((present < lo) | (present > hi)).sum() / n), 4) if n else 0.0,
            "psi": None,
            "psi_threshold": None,
            "psi_ratio": None,
            "ks_pvalue": None,
            "unseen": None,
            "jump": None,
            "mean": round(float(present.mean()), 4) if f in NORMALISED and len(present) else None,
        }
        if max(entry["missing"], entry["out_of_domain"]) > THRESHOLDS["quality_max_rate"]:
            flags.append("quality")
        if f in WEATHER:
            entry["psi_threshold"] = champion.thresholds[f]
            if len(present):
                ref = champion.reference[f]
                entry["psi"] = round(psi(f, ref, present.values), 4)
                entry["psi_ratio"] = entry["psi"] / entry["psi_threshold"]
                entry["ks_pvalue"] = sig(ks_pvalue(ref, present.values))
                if entry["psi_ratio"] > 1:
                    flags.append("drift")
        else:
            entry["unseen"] = round(float((~present.isin(champion.seen[f])).sum() / n), 4) if n else 0.0
            if entry["unseen"] > THRESHOLDS["unseen_max_rate"]:
                flags.append("drift")
        if f in NORMALISED and len(present):
            exact_means[f] = float(present.mean())
        if f in NORMALISED and last_clean_means and entry["mean"] is not None:
            prev = last_clean_means.get(f)
            if prev is not None and champion.ref_std[f] > 0:
                entry["jump"] = round(abs(float(present.mean()) - prev) / champion.ref_std[f], 4)
                if entry["jump"] > THRESHOLDS["jump_max"]:
                    flags.append("jump")
        entry["flags"] = flags
        features.append(entry)

    flagged = {kind: [e["feature"] for e in features if kind in e["flags"]] for kind in ALERT_ORDER}
    order = {f: i for i, f in enumerate(DIAGNOSIS_ORDER)}
    return {
        "week": week,
        "n_rows": n,
        "features": features,
        "quality_failed": flagged["quality"],
        "drifted": sorted(flagged["drift"], key=order.get),
        "jumped": flagged["jump"],
        "alerts": [kind for kind in ALERT_ORDER if flagged[kind]],
        "means": {e["feature"]: e["mean"] for e in features if e["feature"] in NORMALISED},
        "exact_means": exact_means,
    }


def quality_ok(report: dict) -> bool:
    return not report["quality_failed"] and not report["jumped"]


@dataclass
class ErrorRecord:
    """The live model's error on a week, known once that week's true counts arrive."""

    week: int
    version: int
    mae: float
    wape: float
    baseline_wape: float | None
    shadow_version: int | None
    shadow_wape: float | None
    quality_ok: bool
    ratio: float | None

    def to_dict(self) -> dict:
        return asdict(self)


def measure_error(
    week: int, live: ModelVersion, shadow: ModelVersion | None, inputs_ok: bool
) -> ErrorRecord:
    mae, wape = live.errors_on(week)
    shadow_wape = shadow.errors_on(week)[1] if shadow else None
    ratio = round(wape / live.baseline_wape, 3) if live.baseline_wape else None
    return ErrorRecord(
        week=week,
        version=live.version,
        mae=mae,
        wape=wape,
        baseline_wape=live.baseline_wape,
        shadow_version=shadow.version if shadow else None,
        shadow_wape=shadow_wape,
        quality_ok=inputs_ok,
        ratio=ratio,
    )


def recent_clean_errors(errors: dict[int, ErrorRecord], version: int, k: int) -> list[ErrorRecord]:
    """The last ``k`` labelled weeks whose inputs passed the checks, if ``version`` served all
    of them. Weeks served by other models say nothing about the live one."""
    recent = [e for _, e in sorted(errors.items()) if e.quality_ok][-k:]
    if len(recent) < k or any(e.version != version for e in recent):
        return []
    return recent


def _above(e: ErrorRecord) -> bool:
    return e.ratio is not None and e.ratio > THRESHOLDS["error_ratio"]


def error_rising(errors: dict[int, ErrorRecord], version: int) -> bool:
    recent = recent_clean_errors(errors, version, 1)
    return bool(recent) and _above(recent[0])


def error_alert(errors: dict[int, ErrorRecord], version: int) -> bool:
    """Error above the ratio on the last ``error_weeks`` clean labelled weeks."""
    recent = recent_clean_errors(errors, version, THRESHOLDS["error_weeks"])
    return bool(recent) and all(_above(e) for e in recent)


def rollback_evidence(
    errors: dict[int, ErrorRecord], live: ModelVersion, week: int
) -> dict | None:
    """Live vs the model it replaced, on the last two labelled weeks since the promotion."""
    if live.previous is None or live.promoted_week is None:
        return None
    if week - live.promoted_week > THRESHOLDS["rollback_weeks"]:
        return None
    served = [
        e for w, e in sorted(errors.items())
        if w > live.promoted_week and e.version == live.version and e.shadow_wape is not None
    ][-2:]
    weeks = [e.week for e in served]
    if len(served) < 2:
        return {"live": live.version, "previous": live.previous, "weeks": weeks,
                "live_wape": None, "previous_wape": None, "previous_better": False}
    live_wape = float(np.mean([e.wape for e in served]))
    prev_wape = float(np.mean([e.shadow_wape for e in served]))
    return {
        "live": live.version,
        "previous": live.previous,
        "weeks": weeks,
        "live_wape": live_wape,
        "previous_wape": prev_wape,
        "previous_better": prev_wape <= live_wape * (1 - THRESHOLDS["min_improvement"]),
    }


def week_row_start(week: int) -> str:
    return config.week_start(week).strftime("%Y-%m-%d")
