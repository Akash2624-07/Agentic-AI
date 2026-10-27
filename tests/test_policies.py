"""The decision table on hand-made weeks."""

from types import SimpleNamespace

import pytest

from src.engine import Context
from src.policies import diagnose, scheduled


def ctx(*, quality=(), jumped=(), drifted=(), important=("hr", "temp"), rising=False,
        alert=False, evidence=None, due=False):
    report = {
        "quality_failed": list(quality),
        "jumped": list(jumped),
        "drifted": list(drifted),
        "alerts": [],
    }
    return Context(
        week=10, report=report, live=SimpleNamespace(important_features=list(important)),
        labels=None, error_rising=rising, error_alert=alert, weeks_since_last_challenger=1,
        scheduled_check_due=due, rollback_evidence=evidence,
    )


@pytest.mark.parametrize("kwargs, cause, action, reason", [
    ({}, "none", "none", "all signals normal"),
    ({"drifted": ["mnth"]}, "noise", "none", "drift only in unimportant mnth"),
    ({"drifted": ["temp", "mnth"]}, "genuine_drift", "watch", "drift in temp, error not rising yet"),
    ({"drifted": ["temp"], "rising": True}, "genuine_drift", "retrain", "drift in temp and error rising"),
    ({"drifted": ["mnth"], "alert": True}, "genuine_drift", "retrain", "error above threshold for 2 weeks"),
    ({"quality": ["hum"], "drifted": ["temp"], "alert": True}, "pipeline_fault", "alert",
     "quality check failed for hum: fix the pipeline; retraining blocked"),
    ({"evidence": {"previous_better": True}, "alert": True}, "bad_update", "rollback",
     "live model worse than the one it replaced"),
])
def test_decision_table(kwargs, cause, action, reason):
    d = diagnose(ctx(**kwargs))
    assert (d.cause, d.action, d.reason) == (cause, action, reason)


def test_jump_without_quality_failure_is_a_pipeline_fault():
    d = diagnose(ctx(jumped=["temp"]))
    assert (d.cause, d.action) == ("pipeline_fault", "alert")


def test_scheduled_check_keeps_real_drift_only():
    assert scheduled(diagnose(ctx(drifted=["temp"]))).cause == "genuine_drift"
    assert scheduled(diagnose(ctx(drifted=["mnth"]))).cause == "none"
    assert scheduled(diagnose(ctx())).reason == "scheduled check: no challenger for 4+ weeks"
