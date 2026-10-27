"""The UCI Bike Sharing table, split into weekly batches with the demo's faults injected.

Every row carries two versions of the weather features: ``true_*`` (what the sensors
measured) and the delivered value the model and the monitor see. They differ only in
the weeks of an injected fault.
"""

from __future__ import annotations

from functools import lru_cache

import numpy as np
import pandas as pd

from . import config
from .config import FAULTS, FEATURES, TARGET

COLUMNS = [
    ("timestamp", "time", "Start of the hour (dteday + hr)"),
    ("season", "feature", "1 spring, 2 summer, 3 fall, 4 winter"),
    ("mnth", "feature", "Month, 1-12"),
    ("hr", "feature", "Hour of day, 0-23"),
    ("holiday", "feature", "1 if a public holiday"),
    ("weekday", "feature", "Day of week, 0 = Sunday"),
    ("workingday", "feature", "1 if neither weekend nor holiday"),
    ("weathersit", "feature", "1 clear, 2 mist, 3 light rain/snow, 4 heavy rain/snow"),
    ("temp", "feature", "Temperature, normalised: °C / 41, valid range 0-1"),
    ("atemp", "feature", "Feels-like temperature, normalised: °C / 50"),
    ("hum", "feature", "Humidity, normalised: % / 100"),
    ("windspeed", "feature", "Wind speed, normalised: km/h / 67"),
    ("cnt", "target", "Bikes rented in the hour: what the model predicts"),
]

DROPPED = [
    ("instant", "Row id, no information"),
    ("casual", "Casual + registered = cnt, so it leaks the target"),
    ("registered", "Casual + registered = cnt, so it leaks the target"),
    ("yr", "Always 0 in the Jan-Mar 2011 training window, so the model can't learn from it"),
    ("dteday", "Folded into timestamp"),
]

ROW_FIELDS = [
    "timestamp", "week", "split", "fault", "season", "mnth", "hr", "holiday", "weekday",
    "workingday", "weathersit", "atemp", "windspeed", "temp", "hum", "true_temp", "true_hum", "cnt",
]


def inject_faults(frame: pd.DataFrame) -> pd.DataFrame:
    """Overwrite the delivered features in the fault weeks; ``true_*`` keep the real values."""
    out = frame.copy()
    for fault in FAULTS:
        rows = out["week"].between(fault.start, fault.end)
        if fault.kind == "temp_celsius":
            out.loc[rows, "temp"] = out.loc[rows, "true_temp"] * 41
        elif fault.kind == "hum_missing":
            out.loc[rows, "hum"] = np.nan
        else:
            raise ValueError(f"unknown fault {fault.kind}")
    return out


@lru_cache(maxsize=1)
def load() -> pd.DataFrame:
    raw = pd.read_csv(config.DATA_PATH)
    frame = pd.DataFrame(
        {
            "timestamp": pd.to_datetime(raw["dteday"]) + pd.to_timedelta(raw["hr"], unit="h"),
            **{f: raw[f] for f in FEATURES},
            TARGET: raw[TARGET],
        }
    )
    frame["temp"] = frame["temp"].astype(float)
    frame["hum"] = frame["hum"].astype(float)
    frame["week"] = ((frame["timestamp"] - config.WEEK0).dt.days // 7).astype(int)
    frame["split"] = np.where(frame["week"] < 0, "train", "replay")
    frame["true_temp"] = frame["temp"]
    frame["true_hum"] = frame["hum"]
    frame = inject_faults(frame)
    frame["fault"] = [config.faults_in(w) for w in frame["week"]]
    return frame.reset_index(drop=True)


def week(w: int) -> pd.DataFrame:
    frame = load()
    return frame[frame["week"] == w]


def weeks(ws) -> pd.DataFrame:
    frame = load()
    return frame[frame["week"].isin(list(ws))]


def _none(v):
    if v is None:
        return None
    if isinstance(v, float) and np.isnan(v):
        return None
    if isinstance(v, np.integer):
        return int(v)
    if isinstance(v, np.floating):
        return None if np.isnan(v) else float(v)
    return v


def _iso(ts: pd.Timestamp) -> str:
    return ts.strftime("%Y-%m-%dT%H:%M:%S")


def summary() -> dict:
    frame = load()
    train = frame[frame["split"] == "train"]
    replay = frame[frame["split"] == "replay"]

    def part(p: pd.DataFrame) -> dict:
        return {
            "start": _iso(p["timestamp"].min()),
            "end": _iso(p["timestamp"].max()),
            "rows": int(len(p)),
            "weeks": int(p["week"].nunique()),
            "mean_cnt": float(p[TARGET].mean()),
        }

    return {
        "name": "UCI Bike Sharing (hourly), Capital Bikeshare, Washington D.C., 2011-2012",
        "rows": int(len(frame)),
        "columns": [{"name": n, "role": r, "description": d} for n, r, d in COLUMNS],
        "dropped": [{"name": n, "why": w} for n, w in DROPPED],
        "train": part(train),
        "replay": part(replay),
        "faults": [
            {
                "kind": f.kind,
                "label": f.label,
                "feature": f.feature,
                "start_week": f.start,
                "end_week": f.end,
                "start": config.week_start(f.start).strftime("%Y-%m-%d"),
                "end": (config.week_start(f.end) + pd.Timedelta(days=6)).strftime("%Y-%m-%d"),
            }
            for f in FAULTS
        ],
        "label_delay_weeks": config.LABEL_DELAY_WEEKS,
    }


@lru_cache(maxsize=1)
def daily() -> list[dict]:
    frame = load().copy()
    frame["date"] = frame["timestamp"].dt.strftime("%Y-%m-%d")
    out = []
    for date, day in frame.groupby("date", sort=True):
        w = int(day["week"].iloc[0])
        out.append(
            {
                "date": date,
                "cnt": int(day[TARGET].sum()),
                "week": w,
                "split": day["split"].iloc[0],
                "temp": _none(day["true_temp"].mean()),
                "temp_delivered": _none(day["temp"].mean()),
                "hum": _none(day["true_hum"].mean()),
                "hum_delivered": _none(day["hum"].mean()),
                "fault": config.faults_in(w),
            }
        )
    return out


def rows(
    offset: int = 0,
    limit: int = 100,
    split: str | None = None,
    week: int | None = None,
    fault_only: bool = False,
    sort: str = "timestamp",
    desc: bool = False,
) -> dict:
    frame = load()
    if split:
        frame = frame[frame["split"] == split]
    if week is not None:
        frame = frame[frame["week"] == week]
    if fault_only:
        frame = frame[frame["fault"].map(bool)]
    if sort not in ROW_FIELDS or sort == "fault":
        sort = "timestamp"
    frame = frame.sort_values([sort, "timestamp"], ascending=[not desc, True], kind="stable")
    total = int(len(frame))
    page = frame.iloc[max(offset, 0): max(offset, 0) + max(min(limit, 1000), 0)]
    out = []
    for rec in page[ROW_FIELDS].to_dict("records"):
        rec["timestamp"] = _iso(rec["timestamp"])
        out.append({k: (v if k == "fault" else _none(v)) for k, v in rec.items()})
    return {"total": total, "offset": offset, "rows": out}
