"""The weekly loop: the gate, promotion, and a human answering proposals."""

from src.engine import Decision, Replay, gate_reason
from src.monitor import ErrorRecord, error_alert, error_rising


class AlwaysRetrain:
    name = "rules"

    def decide(self, ctx, replay, outcome):
        replay.train_challenger(ctx.week, "test", outcome, ctx.report)
        return Decision("genuine_drift", "retrain", "test")


def test_gate_reason_formats():
    promote = {"challenger": 3, "champion": 2, "holdout_week": 2, "champion_mae": 41.79,
               "challenger_mae": 38.83, "checks": {"beats_champion": True}, "pending": False}
    assert gate_reason(promote) == "v3 vs v2 on week 2: MAE 38.8 vs 41.8 (+7.1%), passed"
    promote["checks"]["beats_champion"] = False
    assert gate_reason(promote).endswith("blocked: beats_champion")
    rollback = {"champion": 7, "previous": 5, "weeks": [23, 24], "champion_wape": 0.16848,
                "previous_wape": 0.14465, "checks": {"previous_better": True}, "pending": True}
    assert gate_reason(rollback) == (
        "v5 vs live v7 on weeks [23, 24]: WAPE 0.145 vs 0.168, awaiting human approval"
    )


def err(week, version, ratio, ok=True):
    return ErrorRecord(week, version, 0, 0, 1, None, None, ok, ratio)


def test_error_alert_needs_the_live_model_on_the_last_clean_weeks():
    errors = {0: err(0, 1, 1.5), 1: err(1, 1, 1.6), 2: err(2, 1, 9.0, ok=False)}
    assert error_alert(errors, 1) and error_rising(errors, 1)
    # After a model change, older weeks of another model don't count.
    errors[3] = err(3, 2, 1.6)
    assert not error_alert(errors, 1) and not error_alert(errors, 2)
    assert error_rising(errors, 2)


def test_eval_mode_promotes_through_the_gate():
    replay = Replay(AlwaysRetrain())
    for _ in range(3):
        replay.step()
    row = replay.rows[2]
    assert row["challenger"] == 4
    gate = replay.weeks[2]["gate"]
    assert gate["checks"]["human_approved"] is True
    assert row["promoted"] == gate["passed"]
    kinds = [e["event"] for e in replay.events if e["week"] == 2]
    assert kinds[0] == "register" and kinds[1] in ("promote", "reject")


def test_live_mode_waits_for_a_human():
    replay = Replay(AlwaysRetrain(), mode="live")
    while not replay.pending and replay.week < 10:
        replay.step()
    assert replay.pending, "a challenger should have passed the gate within 10 weeks"
    week = replay.pending["week"]
    assert replay.rows[week]["reason"].endswith("(awaiting human approval)")
    assert replay.events[-1]["event"] == "awaiting_approval"
    champion = replay.champion
    try:
        replay.step()
        raise AssertionError("step must refuse while a proposal waits")
    except ValueError:
        pass
    replay.resolve(False, "not now")
    assert replay.champion == champion
    assert replay.events[-1]["event"] == "reject"
    assert replay.weeks[week]["gate"]["human"] == {"approved": False, "note": "not now"}
    assert replay.rows[week]["reason"].endswith("(human rejected: not now)")
