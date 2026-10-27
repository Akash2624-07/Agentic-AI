"""The live demo: one session at a time, stepped by the user, proposals approved by a human."""

from __future__ import annotations

import threading
from datetime import datetime

from . import config, policies, store
from .engine import Replay

RUN_MAX_WEEKS = 30


class LiveError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status, self.detail = status, detail


class Session:
    def __init__(self, policy: str, start_week: int):
        if policy not in config.POLICY_NAMES:
            raise LiveError(422, f"unknown policy {policy!r}")
        if not 0 <= start_week < config.N_WEEKS:
            raise LiveError(422, f"start_week must be between 0 and {config.N_WEEKS - 1}")
        self.policy = policy
        self.run_id = f"live:{datetime.now():%Y-%m-%dT%H:%M:%S}"
        # Weeks before the start are fast-forwarded with the gate's automatic approval.
        self.replay = Replay(policies.make(policy), mode="eval")
        for _ in range(start_week):
            self.replay.step()
        self.replay.mode = "live"
        self.save()

    def save(self) -> None:
        store.save(self.run_id, self.policy, "live", self.replay)

    def step(self) -> None:
        if self.replay.pending:
            raise LiveError(409, "A proposal is waiting for your answer: approve or reject it first.")
        if self.replay.done:
            raise LiveError(409, "The replay has finished.")
        self.replay.step()
        self.save()

    def run(self) -> None:
        """Step until the policy does more than watch, a proposal waits, or 30 weeks pass."""
        for _ in range(RUN_MAX_WEEKS):
            self.step()
            row = self.replay.rows[self.replay.week - 1]
            if self.replay.pending or self.replay.done or row["action"] not in ("none", "watch"):
                break

    def resolve(self, approved: bool, note: str) -> None:
        if not self.replay.pending:
            raise LiveError(409, "Nothing is waiting for approval.")
        self.replay.resolve(approved, note.strip()[:500])
        self.save()

    def pending_view(self) -> dict | None:
        pending = self.replay.pending
        if not pending:
            return None
        record = self.replay.weeks[pending["week"]]
        gate = record["gate"]
        if pending["kind"] == "promote":
            gain = (gate["champion_mae"] - gate["challenger_mae"]) / gate["champion_mae"]
            headline = {
                "proposal": f"promote v{gate['challenger']} (replaces v{gate['champion']})",
                "holdout week": gate["holdout_week"],
                f"live v{gate['champion']} MAE": f"{gate['champion_mae']:.1f}",
                f"challenger v{gate['challenger']} MAE": f"{gate['challenger_mae']:.1f}",
                "improvement": f"{gain:.1%}",
            }
        else:
            headline = {
                "proposal": f"roll back to v{gate['previous']}",
                "shadow weeks": ", ".join(str(w) for w in gate["weeks"]),
                f"live v{gate['champion']} WAPE": f"{gate['champion_wape']:.3f}",
                f"previous v{gate['previous']} WAPE": f"{gate['previous_wape']:.3f}",
            }
        return {
            "kind": pending["kind"],
            "reason": record["row"]["reason"].removesuffix(" (awaiting human approval)"),
            "headline": headline,
            "checks": [{"check": k, "passed": v} for k, v in gate["checks"].items()]
            + [{"check": "human_approved", "passed": None}],
            "gate_reason": gate["reason"].removesuffix(", awaiting human approval"),
        }

    def state(self) -> dict:
        replay = self.replay
        last = replay.week - 1
        current = replay.rows.get(last)
        return {
            "active": True,
            "run_id": self.run_id,
            "policy": self.policy,
            "week": last if last >= 0 else None,
            "n_weeks": config.N_WEEKS,
            "live_version": replay.champion,
            "finished": replay.done and not replay.pending,
            "current": current,
            "current_fault": current["fault"] if current else [],
            "error": [
                {k: getattr(e, k) for k in ("week", "ratio", "wape", "version", "quality_ok")}
                for _, e in sorted(replay.errors.items())
            ],
            "events": replay.events,
            "rows": [replay.rows[w] for w in sorted(replay.rows)],
            "pending": self.pending_view(),
        }


class Live:
    """Holds the one session; every call is serialised."""

    def __init__(self):
        self._lock = threading.Lock()
        self.session: Session | None = None

    def state(self) -> dict:
        with self._lock:
            return self.session.state() if self.session else {"active": False}

    def start(self, policy: str, start_week: int) -> dict:
        with self._lock:
            self.session = Session(policy, start_week)
            return self.session.state()

    def _do(self, action: str, *args) -> dict:
        with self._lock:
            if self.session is None:
                raise LiveError(404, "No live session. Start one first.")
            getattr(self.session, action)(*args)
            return self.session.state()

    def step(self) -> dict:
        return self._do("step")

    def run(self) -> dict:
        return self._do("run")

    def resolve(self, approved: bool, note: str) -> dict:
        return self._do("resolve", approved, note)

    def stop(self) -> dict:
        with self._lock:
            self.session = None
            return {"active": False}
