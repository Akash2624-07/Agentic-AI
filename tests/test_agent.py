"""The agent's tool loop with a scripted LLM."""

import json

from src import policies
from src.agent import Agent, parse_answer
from src.engine import Outcome, Replay
from src.llm import Reply, ScriptedChat, ToolCall


def week_context(week=3):
    replay = Replay(policies.make("never"))
    for _ in range(week):
        replay.step()
    return replay, replay.observe()


def answer(**kw):
    return Reply(json.dumps({"cause": "genuine_drift", "action": "watch", "confidence": 0.9,
                             "evidence": ["temp drifted"], **kw}))


def test_tools_run_and_the_registry_wins():
    replay, ctx = week_context()
    chat = ScriptedChat([
        Reply(None, [
            ToolCall("a", "get_monitoring_report", "{}"),
            ToolCall("b", "compare_with_history", '{"weeks": 3}'),
            ToolCall("c", "train_challenger", '{"reason": "temp drift"}'),
        ]),
        answer(action="watch"),
    ])
    outcome = Outcome()
    decision = Agent(chat)._investigate(ctx, replay, outcome)
    assert outcome.challenger is not None
    assert decision.action == "retrain" and decision.path == "llm"
    details = decision.details
    assert details["corrected"] and details["notes"] == ["answer said watch, tools did retrain"]
    assert [c["tool"] for c in details["tool_calls"]] == [
        "get_monitoring_report", "compare_with_history", "train_challenger"]
    assert all("error" not in c["result"] for c in details["tool_calls"])
    report = details["tool_calls"][0]["result"]
    assert report["week"] == 3 and report["labels"]["week"] == 2
    assert [w["week"] for w in details["tool_calls"][1]["result"]["weeks"]] == [1, 2, 3]
    # The tool results went back to the model as tool messages.
    assert [m["role"] for m in chat.requests[1]][-3:] == ["tool", "tool", "tool"]


def test_unknown_tool_and_bad_answer():
    replay, ctx = week_context()
    chat = ScriptedChat([Reply(None, [ToolCall("a", "drop_tables", "{}")]), Reply("I think it is fine")])
    decision = Agent(chat)._investigate(ctx, replay, Outcome())
    assert decision.details["tool_calls"][0]["result"] == {"error": "unknown tool drop_tables"}
    assert decision.details["raw_answer"] == "I think it is fine"
    assert decision.action in ("none", "watch", "retrain")


def test_llm_unavailable_falls_back_to_the_rules():
    replay, ctx = week_context()
    ctx.error_rising = True  # not a quiet week, so the LLM is asked
    decision = Agent(ScriptedChat([])).decide(ctx, replay, Outcome())
    assert decision.path == "fallback" and decision.details["fallback"] is True


def test_parse_answer():
    assert parse_answer('Sure: {"cause": "noise", "action": "none"} done') == {
        "cause": "noise", "action": "none"}
    assert parse_answer("no json") is None
