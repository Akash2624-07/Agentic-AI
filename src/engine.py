"""The weekly loop around the deployed model.

Each ``step()`` is one week: last week's true counts arrive and are scored, this
week's inputs are checked, the policy decides, and any model change goes through the
safety gate (and, in live mode, a human) before it can serve the next week.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from . import config, model
from .config import N_WEEKS, THRESHOLDS
from .model import ModelVersion
from .monitor import (
    ErrorRecord,
    check_inputs,
    error_alert,
    error_rising,
    measure_error,
    quality_ok,
    rollback_evidence,
    week_row_start,
)

INITIAL_WEEKS = list(range(-13, 0))


@dataclass
class Context:
    """What a policy sees when it decides a week."""

    week: int
    report: dict
    live: ModelVersion
    labels: ErrorRecord | None
    error_rising: bool
    error_alert: bool
    weeks_since_last_challenger: int
    scheduled_check_due: bool
    rollback_evidence: dict | None

    @property
    def inputs_ok(self) -> bool:
        return quality_ok(self.report)


@dataclass
class Decision:
    cause: str
    action: str
    reason: str
    confidence: float | None = None
    path: str | None = None
    details: dict | None = None


@dataclass
class Outcome:
    """What the actions taken this week did to the registry."""

    challenger: int | None = None
    gate: dict | None = None
    promoted: bool = False
    rolled_back: bool = False
    pending: dict | None = None
    events: list[dict] = field(default_factory=list)


def gate_reason(gate: dict) -> str:
    if "previous" in gate:
        head = (
            f"v{gate['previous']} vs live v{gate['champion']} on weeks {gate['weeks']}: "
            f"WAPE {gate['previous_wape']:.3f} vs {gate['champion_wape']:.3f}"
        )
    else:
        gain = (gate["champion_mae"] - gate["challenger_mae"]) / gate["champion_mae"]
        head = (
            f"v{gate['challenger']} vs v{gate['champion']} on week {gate['holdout_week']}: "
            f"MAE {gate['challenger_mae']:.1f} vs {gate['champion_mae']:.1f} ({gain:+.1%})"
        )
    failed = [k for k, ok in gate["checks"].items() if not ok]
    if failed:
        return f"{head}, blocked: {', '.join(failed)}"
    if gate.get("pending"):
        return f"{head}, awaiting human approval"
    return f"{head}, passed"


class Replay:
    """One policy driven through the 92 replay weeks."""

    def __init__(self, policy, mode: str = "eval"):
        self.policy = policy
        self.mode = mode
        self.models: dict[int, ModelVersion] = {}
        self.events: list[dict] = []
        self.reports: dict[int, dict] = {}
        self.errors: dict[int, ErrorRecord] = {}
        self.rows: dict[int, dict] = {}
        self.weeks: dict[int, dict] = {}
        self.week = 0
        self.last_challenger_week = -1
        self.pending: dict | None = None
        v1 = model.train(1, INITIAL_WEEKS, created_week=-1)
        v1.status, v1.promoted_week = "champion", -1
        self.models[1] = v1
        self.champion = 1
        self._event(-1, "register", v1, f"trained on {v1.n_rows} rows")
        self._event(-1, "promote", v1, "initial model, Jan-Mar 2011")

    @property
    def live(self) -> ModelVersion:
        return self.models[self.champion]

    @property
    def done(self) -> bool:
        return self.week >= N_WEEKS

    # -- bookkeeping -------------------------------------------------------

    def _event(self, week: int, kind: str, version: ModelVersion, detail: str) -> dict:
        event = {
            "seq": len(self.events),
            "week": week,
            "event": kind,
            "version": version.version,
            "detail": detail,
            "train_weeks": version.span,
            "trained_on_faulty": version.trained_on_faulty,
        }
        self.events.append(event)
        return event

    def _last_clean_means(self, week: int) -> dict | None:
        for w in range(week - 1, -1, -1):
            if w in self.reports and quality_ok(self.reports[w]):
                return self.reports[w]["exact_means"]
        return None

    def labelled_weeks(self, week: int) -> list[int]:
        """Weeks whose true counts are known when deciding ``week``."""
        last = week - config.LABEL_DELAY_WEEKS
        return list(range(-13, last + 1))

    def is_clean(self, w: int) -> bool:
        return w < 0 or (w in self.reports and quality_ok(self.reports[w]))

    def context(self, week: int, report: dict) -> Context:
        live = self.live
        since = week - self.last_challenger_week
        return Context(
            week=week,
            report=report,
            live=live,
            labels=self.errors.get(week - 1),
            error_rising=error_rising(self.errors, live.version),
            error_alert=error_alert(self.errors, live.version),
            weeks_since_last_challenger=since,
            scheduled_check_due=since >= THRESHOLDS["stale_weeks"],
            rollback_evidence=rollback_evidence(self.errors, live, week),
        )

    # -- actions available to policies --------------------------------------

    def _register(self, week: int, train_weeks: list[int]) -> ModelVersion:
        version = max(self.models) + 1
        challenger = model.train(version, train_weeks, created_week=week, parent=self.champion)
        self.models[version] = challenger
        self.last_challenger_week = week
        return challenger

    def _promote(self, week: int, version: ModelVersion, detail: str, outcome: Outcome):
        old = self.live
        old.status = "retired"
        version.status, version.promoted_week, version.previous = "champion", week, old.version
        self.champion = version.version
        outcome.promoted = True
        outcome.events.append(self._event(week, "promote", version, detail))

    def train_challenger(self, week: int, reason: str, outcome: Outcome, report: dict) -> dict:
        """Train on the recent clean window and send the challenger through the gate."""
        window = [w for w in self.labelled_weeks(week) if w >= week - THRESHOLDS["window_weeks"]]
        clean = [w for w in window if self.is_clean(w)]
        holdout = max(clean)
        challenger = self._register(week, [w for w in clean if w < holdout])
        outcome.challenger = challenger.version
        outcome.events.append(
            self._event(week, "register", challenger, f"trained on {challenger.n_rows} rows")
        )
        champion = self.live
        champ_mae = champion.errors_on(holdout)[0]
        chall_mae = challenger.errors_on(holdout)[0]
        checks = {
            "holdout_unseen": holdout not in challenger.train_weeks,
            "data_quality_ok": quality_ok(report) and not challenger.trained_on_faulty,
            "beats_champion": (champ_mae - chall_mae) / champ_mae >= THRESHOLDS["min_improvement"],
        }
        gate = {
            "challenger": challenger.version,
            "champion": champion.version,
            "holdout_week": holdout,
            "champion_mae": champ_mae,
            "challenger_mae": chall_mae,
            "checks": checks,
            "passed": False,
            "pending": False,
        }
        self._settle(week, gate, challenger, reason, outcome, kind="promote")
        return {
            "challenger": challenger.version,
            "gate": gate,
            "promoted": outcome.promoted,
            "awaiting_human": gate["pending"],
        }

    def train_unguarded(self, week: int, reason: str, outcome: Outcome) -> None:
        """Naive retraining: every labelled week in the window, faulty ones included, no gate."""
        window = [w for w in self.labelled_weeks(week) if w >= week - THRESHOLDS["window_weeks"]]
        challenger = self._register(week, window)
        outcome.challenger = challenger.version
        outcome.events.append(
            self._event(week, "register", challenger, f"trained on {challenger.n_rows} rows")
        )
        self._promote(week, challenger, f"{reason} (no gate)", outcome)

    def propose_rollback(self, week: int, reason: str, outcome: Outcome) -> dict:
        evidence = rollback_evidence(self.errors, self.live, week)
        if not evidence or len(evidence["weeks"]) < 2:
            return {"rolled_back": False, "refused": "no eligible rollback evidence", "evidence": evidence}
        previous = self.models[evidence["previous"]]
        gate = {
            "champion": self.champion,
            "previous": previous.version,
            "weeks": evidence["weeks"],
            "champion_wape": evidence["live_wape"],
            "previous_wape": evidence["previous_wape"],
            "checks": {"previous_better": evidence["previous_better"]},
            "passed": False,
            "pending": False,
        }
        self._settle(week, gate, previous, reason, outcome, kind="rollback")
        return {"rolled_back": outcome.rolled_back, "gate": gate, "awaiting_human": gate["pending"]}

    def _settle(self, week, gate, version, reason, outcome, kind):
        """Apply a gate that has its automatic checks filled in."""
        outcome.gate = gate
        if not all(gate["checks"].values()):
            gate["reason"] = gate_reason(gate)
            if kind == "promote":
                outcome.events.append(self._event(week, "reject", version, gate["reason"]))
            return
        if self.mode == "live":
            gate["pending"] = True
            gate["reason"] = gate_reason(gate)
            outcome.pending = {"kind": kind, "version": version.version, "reason": reason, "week": week}
            outcome.events.append(self._event(week, "awaiting_approval", version, gate["reason"]))
            return
        gate["checks"]["human_approved"] = True
        gate["passed"] = True
        gate["reason"] = gate_reason(gate)
        self._apply(week, kind, version, f"{reason}; {gate['reason']}", outcome)

    def _apply(self, week, kind, version, detail, outcome):
        if kind == "promote":
            self._promote(week, version, detail, outcome)
        else:
            replaced = self.live
            replaced.status = "rolled_back"
            version.status = "champion"
            self.champion = version.version
            outcome.rolled_back = True
            outcome.events.append(
                self._event(week, "rollback", version, f"replaces v{replaced.version}: {detail}")
            )

    def resolve(self, approved: bool, note: str = "") -> dict:
        """A human answers the pending proposal (live mode)."""
        if not self.pending:
            raise ValueError("nothing is awaiting approval")
        pending, self.pending = self.pending, None
        week = pending["week"]
        version = self.models[pending["version"]]
        record = self.weeks[week]
        gate = record["gate"]
        gate["human"] = {"approved": approved, "note": note}
        gate["checks"]["human_approved"] = approved
        gate["pending"] = False
        gate["passed"] = approved
        outcome = Outcome()
        verdict = "human approved" if approved else "human rejected"
        if note:
            verdict += f": {note}"
        if approved:
            self._apply(week, pending["kind"], version, f"{pending['reason']}; {verdict}", outcome)
        else:
            kind = "reject" if pending["kind"] == "promote" else "rollback_rejected"
            outcome.events.append(self._event(week, kind, version, f"{gate['reason']}; {verdict}"))
        row = record["row"]
        row["promoted"] = outcome.promoted
        row["rolled_back"] = outcome.rolled_back
        row["gate"] = gate["reason"] if approved else f"{gate['reason']}; {verdict}"
        row["reason"] = row["reason"].replace("(awaiting human approval)", f"({verdict})")
        return {"week": week, "approved": approved, "events": outcome.events}

    # -- the week ------------------------------------------------------------

    def observe(self) -> Context:
        """Start the week: last week's true counts arrive, this week's inputs are checked."""
        week = self.week
        last = week - config.LABEL_DELAY_WEEKS
        if last >= 0:
            served = self.models[self.rows[last]["live_version"]]
            shadow = self.models[served.previous] if served.previous else None
            self.errors[last] = measure_error(last, served, shadow, quality_ok(self.reports[last]))
        report = check_inputs(week, self.live, self._last_clean_means(week))
        self.reports[week] = report
        return self.context(week, report)

    def step(self) -> dict:
        if self.done:
            raise ValueError("replay finished")
        if self.pending:
            raise ValueError("a proposal is awaiting human approval")
        ctx = self.observe()
        week, report, live = ctx.week, ctx.report, ctx.live
        last = week - config.LABEL_DELAY_WEEKS
        outcome = Outcome()
        decision = self.policy.decide(ctx, self, outcome)

        mae, wape = live.errors_on(week)
        changed = outcome.promoted or outcome.rolled_back
        reason = decision.reason
        if outcome.pending:
            reason = f"{reason} (awaiting human approval)"
            self.pending = outcome.pending
        row = {
            "week": week,
            "start": week_row_start(week),
            "live_version": live.version,
            "fault": config.faults_in(week),
            "alerts": report["alerts"] + (["error"] if ctx.error_alert and not changed else []),
            "cause": decision.cause,
            "action": decision.action,
            "reason": reason,
            "confidence": decision.confidence,
            "gate": outcome.gate["reason"] if outcome.gate else None,
            "challenger": outcome.challenger,
            "promoted": outcome.promoted,
            "rolled_back": outcome.rolled_back,
            "mae": mae,
            "wape": wape,
            "path": decision.path,
        }
        self.rows[week] = row
        self.weeks[week] = {
            "row": row,
            "features": [{k: v for k, v in f.items() if k != "mean"} for f in report["features"]],
            "error": self.errors[last].to_dict() if last in self.errors else None,
            "gate": outcome.gate,
            "details": decision.details,
        }
        self.week += 1
        return row

    def run(self) -> None:
        while not self.done:
            self.step()
