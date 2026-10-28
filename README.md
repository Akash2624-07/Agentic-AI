# Feedback Loop Agent for ML Model Monitoring

B.Tech mini project · ABES CSE-DS · industry partner HCL

A weekly loop around a deployed demand model. It watches the inputs and the error,
works out why the model is struggling, and proposes a fix. Fixed rules and a human
decide what reaches production.

- **Data:** UCI Bike Sharing, hourly. A `HistGradientBoostingRegressor` is trained on
  Jan–Mar 2011, then 92 weeks (Apr 2011 – Dec 2012) are replayed one batch of 168
  hours at a time. True counts arrive one week late.
- **Faults:** two are injected and hidden from the policies. Weeks 30–32 deliver
  temperature in °C instead of normalised (×41). In weeks 60–63 the humidity feed
  goes empty.
- **The loop:** Monitor → Diagnose → Propose → Safety gate → Human → Live model.
  - The **monitor** checks each batch for quality, drift (PSI against the live
    model's training window, with per-feature thresholds calibrated on that window's
    own week-to-week noise), unseen calendar values and sudden jumps. A week later it
    adds the error.
  - **Diagnosis** names a cause: noise, genuine drift, pipeline fault, bad update.
  - The **safety gate** lets a challenger go live only if it was scored on an unseen
    holdout week, trained on clean data, and has at least 5% lower MAE. A rollback
    needs the previous model to have done 5% better in shadow.

Four policies are replayed over the same 92 weeks and compared:

| Policy | What it does |
| --- | --- |
| `never` | The original model stays live. |
| `on_alert` | Any alert retrains on recent data, faulty weeks included, without the gate. |
| `rules` | The decision table: block retraining on faulty data, retrain through the gate, roll back bad promotions, retrain when no challenger was trained for 4 weeks. |
| `agent` | An LLM investigates each non-quiet week with tools and answers with a cause, an action, a confidence and evidence. Same gate as the rules. |

## Running it

Requires Python 3.12+ and Node 20.19+ (or 22.12+).

```sh
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt

python -m src.evaluate          # replay all four policies into runs.db (~6 min the first time)
uvicorn src.api:app             # API on :8000; also serves web/dist if it is built
```

The UI:

```sh
cd web
npm ci
npm run dev      # http://localhost:5173, proxies /api to :8000
npm run build    # or build it once and let uvicorn serve it
```

The UI has five pages:
- **Story:** what the project does and the headline results.
- **Dataset:** the data, with the faults.
- **Compare policies:** every metric, week by week.
- **Explore a run:** every decision with its evidence.
- **Live demo:** you step through the weeks and approve or reject the proposals
  yourself.

### The LLM agent

The agent uses OpenAI tool calling:
- `OPENAI_API_KEY` must be set, and `OPENAI_BASE_URL` works for compatible endpoints.
- `LLM_MODEL` picks the model (default `gpt-6-luna`, the one the original
  deployment used).
- Without a key, or when a call fails, the week is decided by the rules. The run
  shows it as `fallback`, and the comparison counts those weeks.
- Answers are cached in `cache/llm.json`, keyed by the full request, so a live
  session replaying weeks the evaluation already decided needs no new calls.

The LLM proposes but never decides:
- `train_challenger` and `propose_rollback` go through the same safety gate as the
  rules.
- The action recorded is what the tools actually did, whatever the final answer
  says.

### Configuration

| Variable | Default | |
| --- | --- | --- |
| `FLA_DB` | `runs.db` | SQLite file with every run |
| `FLA_DATA` | `data/hour.csv` | the UCI table |
| `FLA_MODEL_CACHE` | `cache/models` | fitted models, keyed by training weeks |
| `FLA_LLM_CACHE` | `cache/llm.json` | LLM responses |
| `LLM_MODEL`, `LLM_MAX_TURNS` | `gpt-6-luna`, `4` | the agent's model and tool-call rounds |

### Deploying behind nginx

The UI uses relative URLs, so it can live under any path, as long as `<path>/api/` is
proxied to uvicorn. Redirect `<path>` to `<path>/` (with the trailing slash), otherwise
the relative URLs resolve against the parent path.

## Layout

```
src/
  config.py     constants: weeks, features, faults, thresholds, policies
  data.py       loads hour.csv, injects the faults, dataset views for the API
  model.py      the model and its per-version calibration (PSI thresholds, baseline, importance)
  stats.py      PSI and KS
  monitor.py    input checks, labelled error, error alerts, rollback evidence
  engine.py     the weekly loop, the safety gate, promotions, rollbacks, human approval
  policies.py   never, on_alert and the rules' decision table
  agent.py      the LLM agent: tools, prompt, loop, fallback
  llm.py        OpenAI client with a response cache, and a scripted client for tests
  store.py      SQLite persistence of runs
  reports.py    signals and the policy comparison
  live.py       the live demo session
  evaluate.py   python -m src.evaluate
  api.py        FastAPI app
web/            React + TypeScript + Vite UI (TanStack Query, Recharts)
data/           the UCI Bike Sharing hourly table (CC BY 4.0, see data/README.md)
tests/          pytest; `pytest --runslow` adds a full 92-week replay
recovered/      what the original deployment served, kept as a reference
```

## About this rebuild

The original source was lost. This code was rebuilt from the deployed site: the
production frontend bundle and the backend's API responses, saved in `recovered/`
(see `recovered/README.md`).

- **The frontend** was reconstructed from the bundle. Side by side against the same
  data, it renders the same pages as the original.
- **The backend** was rewritten from the API's outputs.
  - **Exact:** data preparation, the faults, the model and its predictions, MAE and
    WAPE, PSI, KS, unseen rates, jumps, the gate and rollback arithmetic, and the
    comparison metrics all reproduce the original's numbers exactly. The `never` run
    matches week for week, and so does the whole `on_alert` run, every decision and
    every registry event (`pytest --runslow`).
  - **Approximate:** three per-model calibrations couldn't be recovered exactly, so
    they use the closest fit to the recorded values:
    - PSI threshold: 1.07 × the noisiest training week's PSI. Median error 3% against
      88 recorded models.
    - Baseline error: mean one-week-ahead WAPE over the window's last 4 weeks. Median
      error 10%.
    - Feature importance: permutation importance on the last training week.
  - Because these feed the `rules` and `agent` decisions, those two runs follow the
    original's pattern but not week for week. Their headline numbers differ somewhat
    from the original's.
  - The agent's prompt is new. The original's tools and their outputs were recovered
    from its recorded tool calls.
