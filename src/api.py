"""HTTP API for the web UI.

    uvicorn src.api:app

If ``web/dist`` exists it is served too, so one process can host the whole demo.
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config, data, reports, store
from .live import Live, LiveError

app = FastAPI(title="Feedback Loop Agent", version="0.1.0")
live = Live()


class StartRequest(BaseModel):
    policy: str = "rules"
    start_week: int = 0


class ResolveRequest(BaseModel):
    approved: bool
    note: str = ""


@app.exception_handler(LiveError)
def _live_error(_, exc: LiveError):
    return JSONResponse(status_code=exc.status, content={"detail": exc.detail})


def _run_or_404(run_id: str) -> dict:
    run = store.run(run_id)
    if run is None:
        raise HTTPException(404, f"no run {run_id!r}")
    return run


@app.get("/api/meta")
def meta():
    return reports.meta()


@app.get("/api/runs")
def runs():
    return store.runs()


@app.get("/api/comparison")
def comparison():
    return reports.comparison()


@app.get("/api/runs/{run_id}/signals")
def signals(run_id: str):
    run = _run_or_404(run_id)
    return reports.signals(run_id, run["policy"])


@app.get("/api/runs/{run_id}/decisions")
def decisions(run_id: str):
    _run_or_404(run_id)
    return reports.decisions(run_id)


@app.get("/api/runs/{run_id}/weeks/{week}")
def week(run_id: str, week: int):
    _run_or_404(run_id)
    detail = store.week(run_id, week)
    if detail is None:
        raise HTTPException(404, f"run {run_id!r} has no week {week}")
    return detail


@app.get("/api/runs/{run_id}/events")
def events(run_id: str):
    _run_or_404(run_id)
    return store.events(run_id)


@app.get("/api/dataset/summary")
def dataset_summary():
    return data.summary()


@app.get("/api/dataset/daily")
def dataset_daily():
    return data.daily()


@app.get("/api/dataset/rows")
def dataset_rows(
    offset: int = 0,
    limit: int = 100,
    split: str | None = None,
    week: int | None = None,
    fault_only: bool = False,
    sort: str = "timestamp",
    desc: bool = False,
):
    return data.rows(offset, limit, split, week, fault_only, sort, desc)


@app.get("/api/live")
def live_state():
    return live.state()


@app.post("/api/live/start")
def live_start(req: StartRequest):
    return live.start(req.policy, req.start_week)


@app.post("/api/live/step")
def live_step():
    return live.step()


@app.post("/api/live/run")
def live_run():
    return live.run()


@app.post("/api/live/resolve")
def live_resolve(req: ResolveRequest):
    return live.resolve(req.approved, req.note)


@app.post("/api/live/stop")
def live_stop():
    return live.stop()


_dist = config.ROOT / "web" / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="web")
