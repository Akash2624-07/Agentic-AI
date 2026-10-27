"""Chat client for the agent: OpenAI tool calling with an on-disk response cache.

The cache key is the full request, so a live session that replays a week the
evaluation already decided gets the same answer back without a new call.
"""

from __future__ import annotations

import hashlib
import json
import threading
from dataclasses import dataclass, field
from pathlib import Path

from . import config


class LLMUnavailable(RuntimeError):
    pass


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: str


@dataclass
class Reply:
    content: str | None
    tool_calls: list[ToolCall] = field(default_factory=list)
    cached: bool = False

    def to_dict(self) -> dict:
        return {
            "content": self.content,
            "tool_calls": [tc.__dict__ for tc in self.tool_calls],
        }

    @classmethod
    def from_dict(cls, d: dict, cached: bool = False) -> "Reply":
        return cls(d.get("content"), [ToolCall(**tc) for tc in d.get("tool_calls", [])], cached)


class ResponseCache:
    def __init__(self, path: Path | None):
        self.path = path
        self._lock = threading.Lock()
        self._data: dict[str, dict] = {}
        if path and path.exists():
            try:
                self._data = json.loads(path.read_text())
            except (OSError, json.JSONDecodeError):
                self._data = {}

    @staticmethod
    def key(request: dict) -> str:
        return hashlib.sha256(json.dumps(request, sort_keys=True).encode()).hexdigest()

    def get(self, key: str) -> dict | None:
        return self._data.get(key)

    def put(self, key: str, value: dict) -> None:
        with self._lock:
            self._data[key] = value
            if self.path:
                self.path.parent.mkdir(parents=True, exist_ok=True)
                tmp = self.path.with_suffix(".tmp")
                tmp.write_text(json.dumps(self._data))
                tmp.replace(self.path)


class OpenAIChat:
    """``complete(messages, tools) -> Reply``."""

    def __init__(self, model: str = config.LLM_MODEL, cache: ResponseCache | None = None):
        self.model = model
        self.cache = cache if cache is not None else ResponseCache(config.LLM_CACHE_PATH)
        self._client = None

    def _openai(self):
        if self._client is None:
            if not config.llm_configured():
                raise LLMUnavailable("OPENAI_API_KEY is not set")
            from openai import OpenAI

            self._client = OpenAI(timeout=120, max_retries=2)
        return self._client

    def complete(self, messages: list[dict], tools: list[dict]) -> Reply:
        request = {"model": self.model, "messages": messages, "tools": tools}
        key = ResponseCache.key(request)
        hit = self.cache.get(key)
        if hit is not None:
            return Reply.from_dict(hit, cached=True)
        try:
            response = self._openai().chat.completions.create(
                model=self.model, messages=messages, tools=tools, tool_choice="auto"
            )
        except LLMUnavailable:
            raise
        except Exception as exc:  # network, auth, rate limit, bad model name
            raise LLMUnavailable(f"{type(exc).__name__}: {exc}") from exc
        message = response.choices[0].message
        reply = Reply(
            content=message.content,
            tool_calls=[
                ToolCall(tc.id, tc.function.name, tc.function.arguments or "{}")
                for tc in (message.tool_calls or [])
            ],
        )
        self.cache.put(key, reply.to_dict())
        return reply


class ScriptedChat:
    """Plays back prepared replies, for tests and offline demos."""

    model = "scripted"

    def __init__(self, replies: list[Reply]):
        self.replies = list(replies)
        self.requests: list[list[dict]] = []

    def complete(self, messages: list[dict], tools: list[dict]) -> Reply:
        self.requests.append(messages)
        if not self.replies:
            raise LLMUnavailable("no scripted reply left")
        return self.replies.pop(0)
