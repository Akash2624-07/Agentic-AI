"""The rebuild against what the original deployment served (``recovered/api``).

Data preparation, the model, the error metrics and the drift statistics reproduce
the original exactly. The per-model calibration (PSI thresholds, baseline error,
feature importance) is an approximation, so values derived from it are not compared.
"""

import math

import pytest

from conftest import recovered
from src import data


def test_rows_and_faults_match():
    rows = recovered("dataset_rows.json")
    frame = data.load()
    assert len(frame) == len(rows) == 17379
    for rec, (_, ours) in zip(rows, frame.iterrows()):
        assert ours["timestamp"].strftime("%Y-%m-%dT%H:%M:%S") == rec["timestamp"]
        assert ours["week"] == rec["week"] and ours["split"] == rec["split"]
        assert ours["fault"] == rec["fault"]
        for f in ("temp", "hum", "true_temp", "true_hum", "atemp", "windspeed", "cnt"):
            a, b = ours[f], rec[f]
            assert (b is None and math.isnan(a)) or a == pytest.approx(b, abs=1e-12), f


def test_summary_matches():
    ours, theirs = data.summary(), recovered("dataset_summary.json")
    assert ours == theirs


def test_daily_matches():
    ours, theirs = data.daily(), recovered("dataset_daily.json")
    assert len(ours) == len(theirs)
    for a, b in zip(ours, theirs):
        assert a.keys() == b.keys()
        for k in a:
            if isinstance(b[k], float):
                assert a[k] == pytest.approx(b[k], rel=1e-12), (a["date"], k)
            else:
                assert a[k] == b[k], (a["date"], k)


def test_never_retrain_errors_match(never_replay):
    for rec in recovered("runs/eval_never/decisions.json"):
        ours = never_replay.rows[rec["week"]]
        assert ours["mae"] == pytest.approx(rec["mae"], rel=1e-12)
        assert ours["wape"] == pytest.approx(rec["wape"], rel=1e-12)
        assert ours["fault"] == rec["fault"]


CALIBRATION_FREE = ("missing", "out_of_domain", "psi", "ks_pvalue", "unseen", "jump")


def test_never_retrain_input_checks_match(never_replay):
    for week in range(92):
        theirs = recovered(f"runs/eval_never/weeks/{week:02d}.json")["features"]
        ours = never_replay.weeks[week]["features"]
        for a, b in zip(ours, theirs):
            assert a["feature"] == b["feature"]
            for k in CALIBRATION_FREE:
                assert a[k] == pytest.approx(b[k], rel=1e-9), (week, a["feature"], k)
            assert ("quality" in a["flags"]) == ("quality" in b["flags"])
            assert ("jump" in a["flags"]) == ("jump" in b["flags"])


def test_never_retrain_metrics_match(never_replay):
    from src import reports, store

    store.save("eval:never", "never", "eval", never_replay)
    ours = {m["key"]: m["values"]["never"] for m in reports.comparison()["metrics"]}
    theirs = {m["key"]: m["values"]["never"] for m in recovered("comparison.json")["metrics"]}
    assert ours.keys() == theirs.keys()
    for k, v in theirs.items():
        if isinstance(v, float):
            assert ours[k] == pytest.approx(v, rel=1e-12), k
        else:
            assert ours[k] == v, k


@pytest.mark.slow
def test_retrain_on_every_alert_matches():
    """Retraining on every alert has no gate and no importance, so the whole run matches."""
    from src import policies
    from src.engine import Replay

    replay = Replay(policies.make("on_alert"))
    replay.run()
    for rec in recovered("runs/eval_on_alert/decisions.json"):
        ours = replay.rows[rec["week"]]
        for k in ("live_version", "cause", "action", "challenger", "promoted"):
            assert ours[k] == rec[k], (rec["week"], k)
        assert ours["mae"] == pytest.approx(rec["mae"], rel=1e-12)
    theirs = recovered("runs/eval_on_alert/events.json")
    assert [(e["week"], e["event"], e["version"], e["train_weeks"], e["trained_on_faulty"])
            for e in replay.events] == [
        (e["week"], e["event"], e["version"], e["train_weeks"], e["trained_on_faulty"])
        for e in theirs
    ]
