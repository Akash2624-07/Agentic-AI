# Recovered snapshot

A copy of everything the deployed demo served on 2026-10-27, taken after the
original source was lost. It is a reference for the rebuild, not source code.

## `site/`

The production frontend build exactly as served: `index.html` plus the Vite
(rolldown) bundles in `assets/`. It is minified and no source maps were
deployed. Stack, from the bundles: React 19.3, TanStack Query, Recharts.

Pages (lazy-loaded chunks): Story (in `index-*.js`), `DatasetPage`,
`ComparePage`, `ExplorePage`, `LivePage`, plus the shared `WeekChart` and
`WeekDrawer` chunks.

## `api/`

Responses from the FastAPI backend (`uvicorn src.api:app`), saved from its
read-only `GET` routes. The `POST /api/live/*` routes were not called.

| File | Route |
| --- | --- |
| `openapi.json` | `/api/openapi.json` (every route and request schema) |
| `meta.json` | `/api/meta` |
| `runs.json` | `/api/runs` |
| `comparison.json` | `/api/comparison` |
| `dataset_summary.json` | `/api/dataset/summary` |
| `dataset_daily.json` | `/api/dataset/daily` |
| `dataset_rows.json` | `/api/dataset/rows`, all 17,379 rows concatenated |
| `runs/<run>/{signals,decisions,events}.json` | `/api/runs/{run_id}/...` |
| `runs/<run>/weeks/NN.json` | `/api/runs/{run_id}/weeks/{week}` |

Run directories replace the `:` in the run id with `_` (for example
`eval:agent` is `runs/eval_agent/`). The four `eval_*` runs cover all 92
weeks; the `live_*` runs only have the weeks that were stepped through.

The Python backend itself (data prep, fault injection, monitoring, policies,
the agent, the safety gate) never left the server, so none of it is here.
