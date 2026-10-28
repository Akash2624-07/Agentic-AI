"""The LLM agent policy.

Quiet weeks never reach the model: if the decision table would say "nothing to do",
the agent says so too (the fast path), and a due scheduled check trains a challenger
without asking (the scheduled path). Every other week the LLM investigates with tools
and answers with a cause, an action, a confidence and evidence.

The LLM can propose but not decide: ``train_challenger`` and ``propose_rollback`` go
through the same safety gate as the rules, and in a live session a human approves.
If the LLM is unavailable the week is decided by the rules instead.
"""

from __future__ import annotations

import json
import re

from . import config
from .config import CALENDAR, DOMAINS, FEATURES, NORMALISED, THRESHOLDS, WEATHER
from .engine import Context, Decision, Outcome, Replay
from .llm import LLMUnavailable, OpenAIChat, Reply
from .monitor import quality_ok
from .policies import act, diagnose, scheduled
from .stats import sig

CAUSES = ["none", "noise", "genuine_drift", "pipeline_fault", "bad_update", "unclear"]
ACTIONS = ["none", "watch", "retrain", "alert", "rollback", "escalate"]

SYSTEM_PROMPT = f"""\
You monitor a deployed demand model: a HistGradientBoostingRegressor that predicts hourly
bike rentals (UCI Bike Sharing, Washington D.C.) from calendar and weather features. Once a
week a batch of 168 hourly rows arrives. True counts arrive one week late, so the newest
labelled error is always last week's.

Each week you are called only when something needs a judgement. Investigate with the tools,
then decide what caused this week's signals and what to do.

Causes:
- none: nothing is wrong.
- noise: signals fired but they don't matter (e.g. drift only in unimportant features).
- genuine_drift: the world changed (seasons, demand) and the model should learn it.
- pipeline_fault: the data is broken (values missing, out of their valid domain, or a
  sudden jump). Retraining would teach the model the bug.
- bad_update: a recently promoted model does worse than the one it replaced.
- unclear: the evidence conflicts.

Actions:
- none, watch: change nothing (watch = keep an eye on it).
- retrain: call train_challenger. The challenger trains on recent clean weeks and must pass
  the safety gate (unseen holdout week, clean data, at least \
{THRESHOLDS['min_improvement']:.0%} lower MAE than the
  live model) before it can go live.
- alert: tell the data team to fix the pipeline. Never retrain on a week that failed the
  quality checks.
- rollback: call propose_rollback. Only possible within {THRESHOLDS['rollback_weeks']} \
weeks of a promotion, when the previous model did better in shadow on the last two labelled \
weeks.
- escalate: hand the decision to a human.

Rules of thumb:
- Drift in a feature the live model doesn't rely on is noise. PSI is compared with a
  threshold calibrated on the model's own training weeks (psi_ratio > 1 means drifted).
  Calendar features use the unseen rate instead.
- Error is "rising" when last week's WAPE is above {THRESHOLDS['error_ratio']}x the model's \
baseline; error_alert means it was for {THRESHOLDS['error_weeks']} clean weeks in a row.
- Quality failures and jumps (> {THRESHOLDS['jump_max']:g} std from the last clean week) point \
to the pipeline, not the model.
- A scheduled check is due when no challenger was trained for {THRESHOLDS['stale_weeks']} \
weeks.

Your final message must be only a JSON object, no prose around it:
{{"cause": one of {CAUSES}, "action": one of {ACTIONS},
 "confidence": number between 0 and 1,
 "evidence": [short sentences with the numbers that support the decision]}}
If you called train_challenger or propose_rollback, the action must say so (retrain or
rollback) whatever the gate decided; the gate's verdict belongs in the evidence."""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_monitoring_report",
            "description": "This week's input checks, last week's labelled error, the live "
            "champion and rollback evidence.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_data_quality",
            "description": "Missing and out-of-domain rates, weekly means and jumps for every "
            "feature this week, and whether retraining is allowed.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_feature_importance",
            "description": "Permutation importance of the live champion and which drifted "
            "features matter.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_with_history",
            "description": "Signals, labelled errors and model events of recent weeks.",
            "parameters": {
                "type": "object",
                "properties": {
                    "weeks": {"type": "integer", "minimum": 1, "maximum": 12,
                              "description": "How many weeks back, including this one."}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "train_challenger",
            "description": "Train a challenger on the recent clean window and send it through "
            "the safety gate. At most once a week.",
            "parameters": {
                "type": "object",
                "properties": {"reason": {"type": "string"}},
                "required": ["reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_rollback",
            "description": "Reinstate the model the live one replaced, if the rollback gate "
            "agrees.",
            "parameters": {
                "type": "object",
                "properties": {"reason": {"type": "string"}},
                "required": ["reason"],
            },
        },
    },
]
TOOL_NAMES = {t["function"]["name"] for t in TOOLS}


def _r(v, nd=4):
    return None if v is None else round(v, nd)


class Tools:
    """The agent's view of the replay for one week."""

    def __init__(self, ctx: Context, replay: Replay, outcome: Outcome):
        self.ctx, self.replay, self.outcome = ctx, replay, outcome
        self.trained = False
        self.rollback_reason: str | None = None
        self.train_reason: str | None = None

    def call(self, name: str, args: dict) -> dict:
        if name not in TOOL_NAMES:
            return {"error": f"unknown tool {name}"}
        try:
            return getattr(self, name)(**args)
        except TypeError as exc:
            return {"error": f"bad arguments: {exc}"}

    def _features(self) -> dict[str, dict]:
        return {f["feature"]: f for f in self.ctx.report["features"]}

    def get_monitoring_report(self) -> dict:
        ctx, feats = self.ctx, self._features()
        rep = ctx.report
        labels = ctx.labels
        evidence = ctx.rollback_evidence
        return {
            "week": ctx.week,
            "inputs": {
                "week": ctx.week,
                "n_rows": rep["n_rows"],
                "missing": {f: feats[f]["missing"] for f in FEATURES},
                "out_of_domain": {f: feats[f]["out_of_domain"] for f in FEATURES},
                "psi": {f: feats[f]["psi"] for f in WEATHER},
                "psi_threshold": {f: feats[f]["psi_threshold"] for f in WEATHER},
                "ks_pvalue": {f: feats[f]["ks_pvalue"] for f in WEATHER},
                "unseen": {f: feats[f]["unseen"] for f in CALENDAR},
                "jump": {f: feats[f]["jump"] for f in NORMALISED},
                "quality_failed": rep["quality_failed"],
                "drifted": rep["drifted"],
                "jumped": rep["jumped"],
                "alerts": rep["alerts"],
            },
            "labels": None if labels is None else {
                "week": labels.week,
                "version": labels.version,
                "mae": _r(labels.mae, 2),
                "wape": _r(labels.wape),
                "baseline_wape": _r(labels.baseline_wape),
                "shadow_version": labels.shadow_version,
                "shadow_wape": _r(labels.shadow_wape),
                "quality_ok": labels.quality_ok,
                "ratio": labels.ratio,
            },
            "error_rising": ctx.error_rising,
            "error_alert": ctx.error_alert,
            "weeks_since_last_challenger": ctx.weeks_since_last_challenger,
            "scheduled_check_due": ctx.scheduled_check_due,
            "champion": ctx.live.info(),
            "rollback_evidence": None if evidence is None else {
                **evidence,
                "live_wape": _r(evidence["live_wape"]),
                "previous_wape": sig(evidence["previous_wape"], 4),
            },
            "thresholds": {k: THRESHOLDS[k] for k in
                           ("error_ratio", "error_weeks", "unseen_max_rate", "rollback_weeks")},
        }

    def check_data_quality(self) -> dict:
        ctx, feats = self.ctx, self._features()
        return {
            "week": ctx.week,
            "n_rows": ctx.report["n_rows"],
            "features": {
                f: {
                    "missing": feats[f]["missing"],
                    "out_of_domain": feats[f]["out_of_domain"],
                    "valid_domain": list(DOMAINS[f]),
                    "jump_std": feats[f]["jump"],
                    "mean": feats[f]["mean"],
                }
                for f in FEATURES
            },
            "quality_failed": ctx.report["quality_failed"],
            "jumped": ctx.report["jumped"],
            "thresholds": {
                "missing_or_out_of_domain_max": THRESHOLDS["quality_max_rate"],
                "jump_max_std": THRESHOLDS["jump_max"],
            },
            "retraining_allowed": quality_ok(ctx.report),
        }

    def get_feature_importance(self) -> dict:
        live = self.ctx.live
        important = live.important_features
        drifted = self.ctx.report["drifted"]
        return {
            "champion": live.version,
            "mae_increase_when_shuffled": {f: sig(live.importance[f], 4) for f in FEATURES},
            "share": {f: sig(s, 4) for f, s in live.share.items()},
            "important_features": important,
            "important_if_share_at_least": config.IMPORTANT_SHARE,
            "drifted_important": [f for f in drifted if f in important],
            "drifted_unimportant": [f for f in drifted if f not in important],
        }

    def compare_with_history(self, weeks: int = 6) -> dict:
        weeks = max(1, min(int(weeks), 12))
        replay, ctx = self.replay, self.ctx
        out = []
        for w in range(max(0, ctx.week - weeks + 1), ctx.week + 1):
            rep = replay.reports[w]
            feats = {f["feature"]: f for f in rep["features"]}
            live = replay.rows[w]["live_version"] if w in replay.rows else ctx.live.version
            out.append({
                "week": w,
                "live_model": live,
                "alerts": rep["alerts"],
                "quality_failed": rep["quality_failed"],
                "drifted": rep["drifted"],
                "jumped": rep["jumped"],
                "psi_ratio": {f: sig(feats[f]["psi_ratio"], 4) for f in WEATHER},
                "unseen": {f: feats[f]["unseen"] for f in CALENDAR if feats[f]["unseen"]},
                "jump": {f: feats[f]["jump"] for f in NORMALISED},
                "mean": rep["means"],
            })
        first = out[0]["week"]
        errors = [
            {
                "week": e.week,
                "model": e.version,
                "wape": _r(e.wape),
                "ratio": sig(e.wape / e.baseline_wape, 4) if e.baseline_wape else None,
                "shadow_model": e.shadow_version,
                "shadow_wape": _r(e.shadow_wape),
                "inputs_ok": e.quality_ok,
            }
            for w, e in sorted(replay.errors.items()) if w >= first - 1
        ]
        events = [
            {k: e[k] for k in ("week", "event", "version", "detail")}
            for e in replay.events if e["event"] != "register" and e["week"] >= first - 6
        ]
        return {
            "weeks": out,
            "labelled_errors": errors,
            "model_events": events,
            "notes": "psi_ratio = PSI / the then-live champion's threshold (> 1 = drifted); "
            "jump in reference std vs the last clean week; mean = weekly mean of the normalised "
            "weather features (valid domain 0-1)",
        }

    def train_challenger(self, reason: str = "") -> dict:
        if self.trained:
            return {"error": "a challenger was already trained this week"}
        self.trained, self.train_reason = True, reason
        return self.replay.train_challenger(
            self.ctx.week, f"agent: {reason}", self.outcome, self.ctx.report
        )

    def propose_rollback(self, reason: str = "") -> dict:
        if self.outcome.rolled_back or self.outcome.pending:
            return {"error": "a proposal was already made this week"}
        result = self.replay.propose_rollback(self.ctx.week, f"agent: {reason}", self.outcome)
        if "refused" in result:
            return {"error": f"refused: {result['refused']}", "evidence": result["evidence"]}
        self.rollback_reason = reason
        return result


def parse_answer(text: str | None) -> dict | None:
    if not text:
        return None
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        return None
    try:
        answer = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    return answer if isinstance(answer, dict) else None


class Agent:
    name = "agent"

    def __init__(self, chat=None):
        self.chat = chat if chat is not None else OpenAIChat()

    @property
    def model_name(self) -> str:
        return getattr(self.chat, "model", None) or config.LLM_MODEL

    def decide(self, ctx: Context, replay: Replay, outcome: Outcome) -> Decision:
        table = diagnose(ctx)
        quiet = table.action == "none" and not ctx.error_rising
        if quiet and ctx.scheduled_check_due:
            decision = scheduled(table)
            decision.path, decision.details = "scheduled", {"path": "scheduled", "fallback": False}
            return act(ctx, replay, outcome, decision)
        if quiet:
            table.path, table.details = "fast", {"path": "fast", "fallback": False}
            return table
        try:
            return self._investigate(ctx, replay, outcome)
        except LLMUnavailable as exc:
            return self._fallback(ctx, replay, outcome, str(exc))

    def _fallback(self, ctx, replay, outcome, why: str) -> Decision:
        decision = diagnose(ctx)
        if decision.action in ("none", "watch") and ctx.scheduled_check_due:
            decision = scheduled(decision)
        decision = act(ctx, replay, outcome, decision)
        decision.path = "fallback"
        decision.details = {"path": "fallback", "fallback": True, "fallback_reason": why}
        return decision

    def _investigate(self, ctx: Context, replay: Replay, outcome: Outcome) -> Decision:
        tools = Tools(ctx, replay, outcome)
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Week {ctx.week} (starting "
             f"{config.week_start(ctx.week):%Y-%m-%d}) needs a decision. Its alerts: "
             f"{', '.join(ctx.report['alerts']) or 'none'}"
             f"{'; error_alert is true' if ctx.error_alert else ''}."},
        ]
        calls, turns, cached, reply = [], 0, 0, None
        for turn in range(1, config.LLM_MAX_TURNS + 1):
            reply = self.chat.complete(messages, TOOLS)
            turns, cached = turns + 1, cached + int(reply.cached)
            if not reply.tool_calls:
                break
            messages.append({
                "role": "assistant",
                "content": reply.content,
                "tool_calls": [
                    {"id": tc.id, "type": "function",
                     "function": {"name": tc.name, "arguments": tc.arguments}}
                    for tc in reply.tool_calls
                ],
            })
            for tc in reply.tool_calls:
                try:
                    args = json.loads(tc.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}
                result = tools.call(tc.name, args if isinstance(args, dict) else {})
                calls.append({"turn": turn, "tool": tc.name, "args": args, "result": result})
                messages.append({"role": "tool", "tool_call_id": tc.id,
                                 "content": json.dumps(result, default=str)})
        else:
            # Out of turns while still calling tools: ask for the answer without tools.
            messages.append({"role": "user", "content": "No more tools. Answer now with the JSON."})
            reply = self.chat.complete(messages, [])
            turns, cached = turns + 1, cached + int(reply.cached)

        return self._conclude(ctx, replay, outcome, tools, reply, calls, turns, cached)

    def _conclude(self, ctx, replay, outcome, tools: Tools, reply: Reply, calls, turns, cached):
        notes = []
        answer = parse_answer(reply.content)
        raw = None
        if answer is None:
            raw = reply.content
            notes.append("answer was not valid JSON; decided by the rules")
            table = diagnose(ctx)
            answer = {"cause": table.cause, "action": table.action, "confidence": None,
                      "evidence": [table.reason]}
        cause = answer.get("cause") if answer.get("cause") in CAUSES else "unclear"
        action = answer.get("action") if answer.get("action") in ACTIONS else "escalate"
        if cause != answer.get("cause") or action != answer.get("action"):
            notes.append(f"answer had cause={answer.get('cause')!r} action={answer.get('action')!r}")
        try:
            confidence = float(answer.get("confidence"))
            confidence = min(max(confidence, 0.0), 1.0)
        except (TypeError, ValueError):
            confidence = None
        evidence = [str(e) for e in answer.get("evidence") or [] if str(e).strip()]

        # The registry is the truth: the action reported must be what the tools did.
        corrected = False
        if tools.trained and action != "retrain":
            notes.append(f"answer said {action}, tools did retrain")
            action, corrected = "retrain", True
        elif tools.rollback_reason is not None and action != "rollback":
            notes.append(f"answer said {action}, tools did rollback")
            action, corrected = "rollback", True
        elif action == "retrain" and not tools.trained:
            notes.append("answer said retrain without calling train_challenger; trained one")
            tools.train_challenger("; ".join(evidence) or "agent answer: retrain")
        elif action == "rollback" and tools.rollback_reason is None:
            result = tools.propose_rollback("; ".join(evidence) or "agent answer: rollback")
            if "error" in result:
                notes.append(f"answer said rollback but it was {result['error']}; escalated")
                action = "escalate"

        details = {
            "path": "llm",
            "confidence": confidence,
            "evidence": evidence,
            "answer": answer,
            "raw_answer": raw,
            "notes": notes,
            "tool_calls": calls,
            "llm_model": self.model_name,
            "turns": turns,
            "cached_turns": cached,
            "corrected": corrected,
            "fallback": False,
        }
        reason = "; ".join(evidence) or f"{cause} → {action}"
        return Decision(cause, action, reason, confidence, "llm", details)
