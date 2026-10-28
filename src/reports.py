"""Read-side views over stored runs: meta, per-run signals and the policy comparison."""

from __future__ import annotations

from functools import lru_cache

from . import config, data, store
from .config import CALENDAR, FAULTS, NORMALISED, WEATHER


def meta() -> dict:
    return {
        "week0": config.WEEK0.strftime("%Y-%m-%d"),
        "n_weeks": config.N_WEEKS,
        "faults": [
            {"kind": f.kind, "label": f.label, "feature": f.feature, "start": f.start, "end": f.end}
            for f in FAULTS
        ],
        "thresholds": config.THRESHOLDS,
        "policies": config.POLICIES,
        "llm": {
            "provider": config.LLM_PROVIDER,
            "model": config.LLM_MODEL,
            "configured": config.llm_configured(),
        },
        "features": {"calendar": CALENDAR, "weather": WEATHER, "normalised": NORMALISED},
    }


def decisions(run_id: str) -> list[dict]:
    return [w["row"] for w in store.weeks(run_id)]


def signals(run_id: str, policy: str) -> dict:
    weeks = store.weeks(run_id)

    def table(field: str, features: list[str], keep_all: bool) -> dict:
        rows = []
        for w in weeks:
            feats = {f["feature"]: f for f in w["features"]}
            rows.append({"week": w["row"]["week"], **{f: field_value(feats[f], field) for f in features}})
        if not keep_all:
            features = [f for f in features if any(r[f] for r in rows)]
            rows = [{"week": r["week"], **{f: r[f] for f in features}} for r in rows]
        return {"features": features, "rows": rows}

    return {
        "run_id": run_id,
        "policy": policy,
        "weeks": [
            {k: w["row"][k] for k in ("week", "start", "fault", "live_version", "action", "cause", "alerts")}
            for w in weeks
        ],
        "quality": table("quality", sorted(config.FEATURES), keep_all=False),
        "drift": table("psi_ratio", sorted(WEATHER), keep_all=True),
        "unseen": table("unseen", sorted(CALENDAR), keep_all=False),
        "jump": table("jump", sorted(NORMALISED), keep_all=True),
        "error": [
            {k: w["error"][k] for k in ("week", "ratio", "wape", "version", "quality_ok")}
            for w in weeks if w["error"]
        ],
    }


def field_value(feature: dict, field: str):
    if field == "quality":
        return max(feature["missing"], feature["out_of_domain"])
    return feature[field]


@lru_cache(maxsize=1)
def _week_weights() -> dict[int, tuple[int, int]]:
    frame = data.load()
    replay = frame[frame["week"] >= 0]
    return {int(w): (len(g), int(g[config.TARGET].sum())) for w, g in replay.groupby("week")}


METRICS = [
    ("mae", "MAE (bikes / hour)",
     "Mean absolute error of the live model over all weeks (bikes per hour). Lower is better.", "lower"),
    ("wape", "WAPE",
     "Total absolute error / total demand. Like MAE, but fair across seasons as demand triples.", "lower"),
    ("retrains", "Challengers trained", "Challenger models trained during the replay.", "none"),
    ("promotions", "Promotions", "Challengers that became the live model.", "none"),
    ("rollbacks", "Rollbacks", "Times the live model was replaced by the champion before it.", "none"),
    ("retrains_on_faulty_data", "Retrains on faulty data",
     "Challengers whose training data included weeks with an injected fault. Target 0.", "zero"),
    ("promotions_on_faulty_data", "Promotions trained on faulty data",
     "Promoted models trained on faulty weeks. Target 0.", "zero"),
    ("promotions_during_fault", "Promotions during a fault",
     "Promotions made while a fault was active. Target 0.", "zero"),
    ("escalations", "Escalations to a human", "Weeks the policy handed the decision to a human.", "none"),
    ("false_fault_alarms", "False fault alarms",
     "Weeks diagnosed as a pipeline fault when no fault was injected. Target 0.", "zero"),
]


def run_metrics(rows: list[dict], events: list[dict], policy: str) -> dict:
    weights = _week_weights()
    hours = sum(weights[r["week"]][0] for r in rows)
    demand = sum(weights[r["week"]][1] for r in rows)
    replay_events = [e for e in events if e["week"] >= 0]
    promotes = [e for e in replay_events if e["event"] == "promote"]
    out = {
        "mae": sum(r["mae"] * weights[r["week"]][0] for r in rows) / hours,
        "wape": sum(r["wape"] * weights[r["week"]][1] for r in rows) / demand,
        "retrains": sum(e["event"] == "register" for e in replay_events),
        "promotions": len(promotes),
        "rollbacks": sum(e["event"] == "rollback" for e in replay_events),
        "retrains_on_faulty_data": sum(
            e["event"] == "register" and e["trained_on_faulty"] for e in replay_events
        ),
        "promotions_on_faulty_data": sum(e["trained_on_faulty"] for e in promotes),
        "promotions_during_fault": sum(bool(config.faults_in(e["week"])) for e in promotes),
        "escalations": sum(r["action"] == "escalate" for r in rows),
        "false_fault_alarms": sum(r["cause"] == "pipeline_fault" and not r["fault"] for r in rows),
    }
    by_week = {r["week"]: r for r in rows}
    for f in FAULTS:
        detected = [
            w for w in range(f.start, config.N_WEEKS)
            if w in by_week and {"quality", "jump"} & set(by_week[w]["alerts"])
        ]
        out[f"{f.kind}_delay_weeks"] = detected[0] - f.start if detected else None
        fault_weeks = [by_week[w] for w in range(f.start, f.end + 1) if w in by_week]
        hits = sum(r["cause"] == "pipeline_fault" for r in fault_weeks)
        out[f"{f.kind}_diagnosed"] = f"{hits}/{len(fault_weeks)}"
    out["llm_fallback_weeks"] = (
        float(sum(r["path"] == "fallback" for r in rows)) if policy == "agent" else None
    )
    return out


def comparison() -> dict:
    present = {r["policy"]: r["run_id"] for r in store.runs() if r["mode"] == "eval"}
    policies = [p for p in config.POLICY_NAMES if p in present]
    rows = {p: decisions(present[p]) for p in policies}
    events = {p: store.events(present[p]) for p in policies}
    values = {p: run_metrics(rows[p], events[p], p) for p in policies}

    metrics = [
        {"key": k, "label": label, "help": help_, "better": better,
         "values": {p: values[p][k] for p in policies}}
        for k, label, help_, better in METRICS
    ]
    for f in FAULTS:
        metrics.append({
            "key": f"{f.kind}_delay_weeks",
            "label": f"Detection delay: {f.kind} (weeks)",
            "help": f"Weeks from the start of the {f.kind} fault until a quality or jump alert "
                    "fired (0 = same week).",
            "better": "lower",
            "values": {p: values[p][f"{f.kind}_delay_weeks"] for p in policies},
        })
        metrics.append({
            "key": f"{f.kind}_diagnosed",
            "label": f"Fault weeks diagnosed: {f.kind}",
            "help": f"Fault weeks of {f.kind} whose diagnosed cause was pipeline_fault "
                    "(correct / total).",
            "better": "higher",
            "values": {p: values[p][f"{f.kind}_diagnosed"] for p in policies},
        })
    metrics.append({
        "key": "llm_fallback_weeks",
        "label": "Weeks the LLM was unavailable",
        "help": "Weeks decided by the rules because the LLM was unavailable.",
        "better": "zero",
        "values": {p: values[p]["llm_fallback_weeks"] for p in policies},
    })

    def weekly(field: str) -> list[dict]:
        return [
            {
                "week": w,
                "start": config.week_start(w).strftime("%Y-%m-%d"),
                **{p: next((r[field] for r in rows[p] if r["week"] == w), None) for p in policies},
            }
            for w in range(config.N_WEEKS)
        ]

    return {
        "policies": policies,
        "metrics": metrics,
        "weekly": weekly("wape"),
        "weekly_mae": weekly("mae"),
        "events": [
            {"policy": p, "week": e["week"], "event": e["event"]}
            for p in policies for e in events[p]
            if e["week"] >= 0 and e["event"] in ("promote", "rollback")
        ],
    }
