import { useCallback, useMemo } from 'react';
import { useDecisions, useEvents, useMeta, useRuns, useSignals } from '../api/queries';
import type { RunInfo } from '../api/types';
import { ChartCard } from '../components/ChartCard';
import { DecisionLog } from '../components/DecisionLog';
import { WeekDrawer } from '../components/drawer/WeekDrawer';
import { ErrorBox } from '../components/ErrorBox';
import { Icon } from '../components/Icon';
import { PageHead } from '../components/PageHead';
import { RegistryTimeline } from '../components/RegistryTimeline';
import { ChartSkeleton } from '../components/signals/ChartSkeleton';
import { DriftChart } from '../components/signals/DriftChart';
import { ErrorChart } from '../components/signals/ErrorChart';
import { JumpChart } from '../components/signals/JumpChart';
import { QualityChart } from '../components/signals/QualityChart';
import type { ChartContext } from '../components/signals/shared';
import { UnseenChart } from '../components/signals/UnseenChart';
import { Skeleton } from '../components/Skeleton';
import { formatAgo, formatWeekStart } from '../lib/format';
import { POLICY_ORDER, policyColor, policyLabel } from '../lib/policies';
import { setParams, useRoute } from '../lib/router';

/** Evaluation runs in policy order, live sessions newest first. */
function groupRuns(runs: RunInfo[]) {
  return {
    evals: runs
      .filter((run) => run.mode === 'eval')
      .sort((a, b) => POLICY_ORDER.indexOf(a.policy) - POLICY_ORDER.indexOf(b.policy)),
    live: runs.filter((run) => run.mode !== 'eval').sort((a, b) => b.created_at.localeCompare(a.created_at)),
  };
}

export default function ExplorePage() {
  const { params } = useRoute();
  const meta = useMeta();
  const runs = useRuns();
  const groups = useMemo(() => groupRuns(runs.data ?? []), [runs.data]);

  // Default to the rules evaluation.
  const runId =
    params.get('run') ??
    (groups.evals.find((run) => run.policy === 'rules') ?? groups.evals[0] ?? groups.live[0])?.run_id ??
    null;
  const weekParam = params.get('week');
  const selectedWeek =
    weekParam !== null && weekParam !== '' && Number.isFinite(Number(weekParam)) ? Number(weekParam) : null;
  const run = runs.data?.find((r) => r.run_id === runId);

  const signals = useSignals(runId);
  const decisions = useDecisions(runId);
  const events = useEvents(runId);

  const week0 = meta.data?.week0 ?? '2011-04-01';
  const nWeeks = signals.data?.weeks.length
    ? Math.max(...signals.data.weeks.map((w) => w.week)) + 1
    : (meta.data?.n_weeks ?? 92);
  const faults = meta.data?.faults ?? [];

  const openWeek = useCallback((week: number) => setParams({ week }), []);
  const closeWeek = useCallback(() => setParams({ week: null }), []);

  const ctx = useMemo<ChartContext>(
    () => ({ week0, faults, nWeeks, selectedWeek, onWeekClick: openWeek }),
    [week0, faults, nWeeks, selectedWeek, openWeek],
  );

  const registry = events.data ?? [];
  const promotions = registry.filter((e) => e.event === 'promote' && e.week >= 0).length;
  const rollbacks = registry.filter((e) => e.event === 'rollback').length;
  const promotionsInFault = registry.filter(
    (e) => e.event === 'promote' && faults.some((f) => e.week >= f.start && e.week <= f.end),
  ).length;
  const rows = decisions.data ?? [];
  const isLive = run?.mode === 'live';

  return (
    <div className="stack-lg">
      <div className="stack">
        <PageHead eyebrow="Explore a run" title="Week by week: what the loop saw and did">
          Five signals, one decision per week. Click any chart or row to open that week's evidence. The red bands are
          the injected faults; the policy never sees them.
        </PageHead>
        <div className="card card-pad row" style={{ gap: 16 }}>
          <label className="field" style={{ minWidth: 260, flex: '1 1 260px', maxWidth: 420 }}>
            Run
            <select
              className="select"
              value={runId ?? ''}
              onChange={(event) => setParams({ run: event.target.value, week: null })}
              disabled={!runs.data}
            >
              {!runs.data && <option>Loading runs…</option>}
              {groups.evals.length > 0 && (
                <optgroup label="Evaluation runs (92 weeks each)">
                  {groups.evals.map((r) => (
                    <option key={r.run_id} value={r.run_id}>
                      {policyLabel(r.policy)} · {r.run_id}
                    </option>
                  ))}
                </optgroup>
              )}
              {groups.live.length > 0 && (
                <optgroup label="Live sessions">
                  {groups.live.map((r) => (
                    <option key={r.run_id} value={r.run_id}>
                      {policyLabel(r.policy)} · {r.run_id}
                    </option>
                  ))}
                </optgroup>
              )}
              {runId && !run && runs.data && <option value={runId}>{runId}</option>}
            </select>
          </label>
          {run && (
            <div className="row small ink2" style={{ gap: 18 }}>
              <span className="row" style={{ gap: 6 }}>
                <span
                  className={`key-line${run.policy === 'never' ? ' dash' : ''}`}
                  style={{ color: policyColor(run.policy) }}
                />
                <b style={{ color: 'var(--ink)' }}>{policyLabel(run.policy)}</b>
                {' · '}
                {run.mode === 'eval' ? 'evaluation' : 'live session'}
              </span>
              <span>
                <b className="num" style={{ color: 'var(--ink)' }}>
                  {rows.length || '…'}
                </b>
                {' weeks logged'}
              </span>
              <span>
                <b className="num" style={{ color: 'var(--ink)' }}>
                  {events.data ? promotions : '…'}
                </b>
                {' promotions,'}{' '}
                <b className="num" style={{ color: 'var(--ink)' }}>
                  {events.data ? rollbacks : '…'}
                </b>
                {' rollbacks'}
              </span>
              <span className="muted">created {formatAgo(run.created_at)}</span>
            </div>
          )}
          <span className="spacer" />
          {selectedWeek !== null && (
            <span className="badge tone-info lg">
              Week {selectedWeek} · {formatWeekStart(week0, selectedWeek)}
              <button
                className="btn ghost sm"
                style={{ padding: '0 4px' }}
                onClick={closeWeek}
                aria-label="Clear selected week"
              >
                <Icon name="x" size={12} />
              </button>
            </span>
          )}
        </div>
        {runs.isError && <ErrorBox error={runs.error} what="the runs" />}
        {!runs.isLoading && runs.data?.length === 0 && (
          <div className="callout">
            No runs yet. Run the evaluation (<code>uv run python -m src.evaluate</code>) or start a live session.
          </div>
        )}
      </div>

      <section className="stack">
        <div className="row" style={{ alignItems: 'baseline' }}>
          <h2>The five signals</h2>
          <span className="small muted">Hover one chart and the others follow; click to open the week.</span>
        </div>
        {signals.isError && <ErrorBox error={signals.error} what="the signals" />}
        {signals.data ? (
          <div className={`stack ${signals.isFetching ? 'dim' : ''}`}>
            <div className="grid-2">
              <QualityChart s={signals.data} c={ctx} />
              <DriftChart s={signals.data} c={ctx} />
            </div>
            <div className="grid-2">
              <UnseenChart s={signals.data} c={ctx} />
              <JumpChart s={signals.data} c={ctx} />
            </div>
            <ErrorChart error={signals.data.error} c={ctx} meta={meta.data} />
          </div>
        ) : (
          !signals.isError && (
            <div className="stack">
              <div className="grid-2">
                <ChartSkeleton />
                <ChartSkeleton />
              </div>
              <div className="grid-2">
                <ChartSkeleton />
                <ChartSkeleton />
              </div>
            </div>
          )
        )}
      </section>

      <ChartCard
        title="Decision log"
        sub={
          <>
            One row per week. Filter by action or cause; click a row for its evidence.
            {isLive ? ' Live session: the newest weeks are at the bottom.' : ''}
          </>
        }
      >
        {decisions.isError ? (
          <div style={{ padding: 20 }}>
            <ErrorBox error={decisions.error} what="the decisions" />
          </div>
        ) : decisions.data ? (
          <DecisionLog rows={rows} selectedWeek={selectedWeek} onPick={openWeek} />
        ) : (
          <div style={{ padding: 20 }} className="stack">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} h={22} />
            ))}
          </div>
        )}
      </ChartCard>

      <ChartCard
        title="Model registry"
        sub="Every model trained, promoted, rejected by the gate or rolled back"
        explain={{
          seeing: (
            <>
              The life of each model version: trained (registered), then promoted, rejected by the safety gate, or
              rolled back.
            </>
          ),
          read: <>▲ a model went live, ✕ the previous model came back, ○ the gate said no. Red bands are the faults.</>,
          notice: (
            <>
              {run?.policy === 'never'
                ? 'One model for the whole replay: nothing is ever retrained.'
                : promotionsInFault > 0
                  ? `${promotionsInFault} promotion${promotionsInFault > 1 ? 's' : ''} inside a red band: new models went live while the data was broken.`
                  : 'No promotion inside a red band: retraining is blocked while the data is broken.'}
            </>
          ),
        }}
      >
        {events.isError ? (
          <div style={{ padding: 20 }}>
            <ErrorBox error={events.error} what="the registry" />
          </div>
        ) : events.data ? (
          <RegistryTimeline events={events.data} faults={faults} nWeeks={nWeeks} onPick={openWeek} />
        ) : (
          <div style={{ padding: 20 }}>
            <Skeleton h={160} />
          </div>
        )}
      </ChartCard>

      {runId && selectedWeek !== null && (
        <WeekDrawer
          runId={runId}
          week={selectedWeek}
          week0={week0}
          nWeeks={nWeeks}
          onClose={closeWeek}
          onWeek={(week) => setParams({ week: Math.max(0, Math.min(nWeeks - 1, week)) })}
        />
      )}
    </div>
  );
}
