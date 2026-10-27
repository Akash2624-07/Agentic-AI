"""Constants shared by the replay, the policies and the API."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = Path(os.environ.get("FLA_DATA", ROOT / "data" / "hour.csv"))
DB_PATH = Path(os.environ.get("FLA_DB", ROOT / "runs.db"))
LLM_CACHE_PATH = Path(os.environ.get("FLA_LLM_CACHE", ROOT / "cache" / "llm.json"))
MODEL_CACHE_DIR = Path(os.environ.get("FLA_MODEL_CACHE", ROOT / "cache" / "models"))

WEEK0 = pd.Timestamp("2011-04-01")
N_WEEKS = 92
LABEL_DELAY_WEEKS = 1

CALENDAR = ["season", "mnth", "hr", "holiday", "weekday", "workingday"]
WEATHER = ["weathersit", "temp", "atemp", "hum", "windspeed"]
FEATURES = CALENDAR + WEATHER
NORMALISED = ["temp", "atemp", "hum", "windspeed"]
CATEGORICAL_WEATHER = ["weathersit"]
TARGET = "cnt"

# Valid domain of every feature as delivered by the pipeline.
DOMAINS: dict[str, tuple[float, float]] = {
    "season": (1, 4),
    "mnth": (1, 12),
    "hr": (0, 23),
    "holiday": (0, 1),
    "weekday": (0, 6),
    "workingday": (0, 1),
    "weathersit": (1, 4),
    "temp": (0.0, 1.0),
    "atemp": (0.0, 1.0),
    "hum": (0.0, 1.0),
    "windspeed": (0.0, 1.0),
}


@dataclass(frozen=True)
class Fault:
    kind: str
    label: str
    feature: str
    start: int
    end: int

    def active(self, week: int) -> bool:
        return self.start <= week <= self.end


FAULTS = [
    Fault("temp_celsius", "Temperature arrives in °C instead of normalised (x41)", "temp", 30, 32),
    Fault("hum_missing", "Humidity feed goes empty", "hum", 60, 63),
]

THRESHOLDS = {
    "quality_max_rate": 0.05,
    "jump_max": 3.0,
    "unseen_max_rate": 0.05,
    "error_ratio": 1.25,
    "error_weeks": 2,
    "min_improvement": 0.05,
    "rollback_weeks": 6,
    "stale_weeks": 4,
    "window_weeks": 26,
}

# Features whose permutation-importance share is at least this are "important".
IMPORTANT_SHARE = 0.05
# A weather feature drifts when its PSI exceeds the noisiest training week by this factor.
PSI_HEADROOM = 1.07
# The baseline error is the mean one-week-ahead WAPE over this many weeks at the end of
# the training window.
BASELINE_WEEKS = 4
PSI_BINS = 10
PSI_EPS = 1e-4

MODEL_PARAMS = {"max_iter": 300, "learning_rate": 0.05, "random_state": 0}

POLICIES = [
    {
        "name": "never",
        "label": "Never retrain",
        "description": "The original Jan-Mar 2011 model stays live for all 92 weeks.",
        "uses_llm": False,
    },
    {
        "name": "on_alert",
        "label": "Retrain on every alert",
        "description": "Naive automation: any alert retrains on recent data, faulty weeks included, "
        "and promotes without the safety gate.",
        "uses_llm": False,
    },
    {
        "name": "rules",
        "label": "Rule-based",
        "description": "The decision table as fixed rules: block retraining on faulty data, retrain "
        "through the safety gate, roll back bad promotions.",
        "uses_llm": False,
    },
    {
        "name": "agent",
        "label": "LLM agent",
        "description": "Investigates each non-quiet week with tools and returns a diagnosis with "
        "evidence and confidence; same safety gate as the rules.",
        "uses_llm": True,
    },
]
POLICY_NAMES = [p["name"] for p in POLICIES]

LLM_PROVIDER = "openai"
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-6-luna")
LLM_MAX_TURNS = int(os.environ.get("LLM_MAX_TURNS", "4"))


def llm_configured() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY"))


def week_start(week: int) -> pd.Timestamp:
    return WEEK0 + pd.Timedelta(days=7 * week)


def faults_in(week: int) -> list[str]:
    return [f.kind for f in FAULTS if f.active(week)]
