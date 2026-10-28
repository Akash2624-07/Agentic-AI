"""Every route the web UI calls."""

import pytest
from fastapi.testclient import TestClient

from src import store
from src.api import app


@pytest.fixture
def client(never_replay):
    store.save("eval:never", "never", "eval", never_replay)
    with TestClient(app) as c:
        yield c
    app_live_reset()


def app_live_reset():
    from src.api import live

    live.stop()


def test_read_routes(client):
    assert client.get("/api/meta").json()["n_weeks"] == 92
    assert [r["run_id"] for r in client.get("/api/runs").json()] == ["eval:never"]
    comparison = client.get("/api/comparison").json()
    assert comparison["policies"] == ["never"] and len(comparison["weekly"]) == 92
    signals = client.get("/api/runs/eval:never/signals").json()
    assert signals["quality"]["features"] == ["hum", "temp"]
    assert len(client.get("/api/runs/eval:never/decisions").json()) == 92
    week = client.get("/api/runs/eval:never/weeks/30").json()
    assert week["row"]["fault"] == ["temp_celsius"] and week["error"]["week"] == 29
    assert client.get("/api/runs/eval:never/weeks/92").status_code == 404
    assert client.get("/api/runs/nope/decisions").status_code == 404
    assert client.get("/api/runs/eval:never/events").json()[0]["event"] == "register"
    rows = client.get("/api/dataset/rows", params={"fault_only": True, "sort": "temp",
                                                   "desc": True, "limit": 5}).json()
    assert rows["total"] == 1176 and rows["rows"][0]["temp"] == 0.64 * 41
    assert len(client.get("/api/dataset/daily").json()) == 731


def test_live_session(client):
    assert client.get("/api/live").json() == {"active": False}
    assert client.post("/api/live/step").status_code == 404
    state = client.post("/api/live/start", json={"policy": "never", "start_week": 2}).json()
    assert state["active"] and state["week"] == 1 and state["run_id"].startswith("live:")
    state = client.post("/api/live/step").json()
    assert state["week"] == 2 and state["current"]["reason"] == "policy never retrains"
    state = client.post("/api/live/run").json()
    assert state["week"] == 32 and state["pending"] is None
    assert client.post("/api/live/resolve", json={"approved": True}).status_code == 409
    run_id = state["run_id"]
    assert len(client.get(f"/api/runs/{run_id}/decisions").json()) == 33
    assert client.post("/api/live/stop").json() == {"active": False}
    assert client.post("/api/live/start", json={"policy": "nope"}).status_code == 422
