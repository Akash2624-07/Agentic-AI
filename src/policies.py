"""The policies compared in the evaluation, except the LLM agent (see ``agent.py``)."""

from __future__ import annotations

from .config import THRESHOLDS
from .engine import Context, Decision, Outcome, Replay

SCHEDULED = f"scheduled check: no challenger for {THRESHOLDS['stale_weeks']}+ weeks"


def diagnose(ctx: Context) -> Decision:
    """The decision table, first matching row wins."""
    report = ctx.report
    if report["quality_failed"]:
        return Decision(
            "pipeline_fault", "alert",
            f"quality check failed for {', '.join(report['quality_failed'])}: "
            "fix the pipeline; retraining blocked",
        )
    if report["jumped"]:
        return Decision(
            "pipeline_fault", "alert",
            f"{', '.join(report['jumped'])} jumped more than {THRESHOLDS['jump_max']:g} std "
            "since the last clean week: fix the pipeline; retraining blocked",
        )
    evidence = ctx.rollback_evidence
    if evidence and evidence["previous_better"]:
        return Decision("bad_update", "rollback", "live model worse than the one it replaced")
    if ctx.error_alert:
        return Decision(
            "genuine_drift", "retrain", f"error above threshold for {THRESHOLDS['error_weeks']} weeks"
        )
    important = set(ctx.live.important_features)
    drifted = report["drifted"]
    drifted_important = [f for f in drifted if f in important]
    if drifted_important:
        names = ", ".join(drifted_important)
        if ctx.error_rising:
            return Decision("genuine_drift", "retrain", f"drift in {names} and error rising")
        return Decision("genuine_drift", "watch", f"drift in {names}, error not rising yet")
    if drifted:
        return Decision("noise", "none", f"drift only in unimportant {', '.join(drifted)}")
    return Decision("none", "none", "all signals normal")


def scheduled(decision: Decision) -> Decision:
    """A challenger is due: keep a real diagnosis, otherwise there is no cause to report."""
    cause = decision.cause if decision.cause == "genuine_drift" else "none"
    return Decision(cause, "retrain", SCHEDULED)


def act(ctx: Context, replay: Replay, outcome: Outcome, decision: Decision) -> Decision:
    """Carry out a retrain or rollback decision through the safety gate."""
    if decision.action == "retrain":
        replay.train_challenger(ctx.week, decision.reason, outcome, ctx.report)
    elif decision.action == "rollback":
        replay.propose_rollback(ctx.week, decision.reason, outcome)
        if outcome.gate:
            decision.reason = outcome.gate["reason"]
    return decision


class Never:
    name = "never"

    def decide(self, ctx: Context, replay: Replay, outcome: Outcome) -> Decision:
        return Decision("none", "none", "policy never retrains")


class OnAlert:
    name = "on_alert"

    def decide(self, ctx: Context, replay: Replay, outcome: Outcome) -> Decision:
        alerts = ctx.report["alerts"] + (["error"] if ctx.error_alert else [])
        if not alerts:
            return Decision("none", "none", "no alerts")
        reason = f"alerts: {', '.join(alerts)}"
        replay.train_unguarded(ctx.week, reason, outcome)
        return Decision("unknown", "retrain", reason)


class Rules:
    name = "rules"

    def decide(self, ctx: Context, replay: Replay, outcome: Outcome) -> Decision:
        decision = diagnose(ctx)
        if decision.action in ("none", "watch") and ctx.scheduled_check_due:
            decision = scheduled(decision)
        return act(ctx, replay, outcome, decision)


def make(name: str, **kwargs):
    if name == "never":
        return Never()
    if name == "on_alert":
        return OnAlert()
    if name == "rules":
        return Rules()
    if name == "agent":
        from .agent import Agent

        return Agent(**kwargs)
    raise ValueError(f"unknown policy {name!r}")
