import { useMemo, useState } from 'react';
import { useComparison, useMeta } from '../api/queries';
import { ChartCard } from '../components/ChartCard';
import { WeekChart, type Series } from '../components/charts/WeekChart';
import { CompareNotes } from '../components/compare/CompareNotes';
import { Scorecard } from '../components/compare/Scorecard';
import { ErrorBox } from '../components/ErrorBox';
import { PageHead } from '../components/PageHead';
import { Segmented } from '../components/Segmented';
import { Skeleton } from '../components/Skeleton';
import type { ComparisonWeek } from '../api/types';
import { formatWeekStart } from '../lib/format';
import { POLICY_ORDER, policyColor, policyDash, policyLabel } from '../lib/policies';

type Measure = 'wape' | 'mae';

export default function ComparePage() {
  const meta = useMeta();
  const comparisonQuery = useComparison();
  const [measure, setMeasure] = useState<Measure>('wape');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showEvents, setShowEvents] = useState(true);
  const comparison = comparisonQuery.data;

  const policies = useMemo(
    () => (comparison ? [...comparison.policies].sort((a, b) => POLICY_ORDER.indexOf(a) - POLICY_ORDER.indexOf(b)) : []),
    [comparison],
  );

  // policy → week → the registry event to mark; a rollback wins over a promotion in the same week.
  const eventsByPolicy = useMemo(() => {
    const byPolicy = new Map<string, Map<number, 'promote' | 'rollback'>>();
    for (const event of comparison?.events ?? []) {
      if (!byPolicy.has(event.policy)) byPolicy.set(event.policy, new Map());
      if (byPolicy.get(event.policy)!.get(event.week) !== 'rollback') {
        byPolicy.get(event.policy)!.set(event.week, event.event);
      }
    }
    return byPolicy;
  }, [comparison]);

  const series = useMemo<Series<ComparisonWeek>[]>(
    () =>
      policies
        .filter((policy) => !hidden.has(policy))
        .map((policy) => ({
          key: policy,
          label: policyLabel(policy),
          color: policyColor(policy),
          dash: policyDash(policy),
          dot: showEvents ? (row) => eventsByPolicy.get(policy)?.get(row.week) ?? null : undefined,
        })),
    [policies, hidden, showEvents, eventsByPolicy],
  );

  const weekly = measure === 'wape' ? comparison?.weekly : comparison?.weekly_mae;
  const week0 = meta.data?.week0 ?? '2011-04-01';

  // At least one policy stays visible.
  const togglePolicy = (policy: string) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(policy)) next.delete(policy);
      else if (policies.length - next.size > 1) next.add(policy);
      return next;
    });

  return (
    <div className="stack-lg">
      <div className="stack">
        <PageHead eyebrow="Compare policies" title="Four ways to run the same loop">
          Every policy replays the same 92 weeks with the same two injected faults. Only the decision-maker changes.
        </PageHead>
        <div className="grid-4">
          {(meta.data?.policies ?? []).map((policy) => (
            <div key={policy.name} className="card card-pad" style={{ padding: '14px 16px' }}>
              <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                <span
                  className={`key-line${policy.name === 'never' ? ' dash' : ''}`}
                  style={{ color: policyColor(policy.name) }}
                />
                <strong>{policy.label}</strong>
              </div>
              <p className="small ink2">{policy.description}</p>
            </div>
          ))}
          {!meta.data && [0, 1, 2, 3].map((i) => <Skeleton key={i} h={96} r={10} />)}
        </div>
      </div>

      {comparisonQuery.isError && <ErrorBox error={comparisonQuery.error} what="the comparison" />}

      <ChartCard
        title={measure === 'wape' ? 'Weekly error of the live model (WAPE)' : 'Weekly error of the live model (MAE)'}
        sub={measure === 'wape' ? 'Total absolute error / total rentals that week' : 'Mean absolute error, bikes per hour'}
        right={
          <div className="row" style={{ gap: 8 }}>
            <Segmented
              label="Error measure"
              value={measure}
              onChange={setMeasure}
              options={[
                { value: 'wape', label: 'WAPE' },
                { value: 'mae', label: 'MAE' },
              ]}
            />
          </div>
        }
        explain={{
          seeing: (
            <>
              {'The weekly error of whichever model was live under each policy, '}
              {measure === 'wape' ? 'as WAPE (error relative to demand)' : 'as MAE in bikes per hour'}.
            </>
          ),
          read: (
            <>
              Lower is better. <b>▲</b> a new model went live, <b>✕</b> a rollback. Red bands are the injected faults,
              which the policies never see. Click a policy to hide it.
            </>
          ),
          notice: (
            <>
              The frozen model (dashed) climbs as demand grows. Naive retraining puts <b>▲ inside the red bands</b>:
              models trained on broken data, promoted mid-incident. The rules have none there.
            </>
          ),
        }}
      >
        <div className="row" style={{ padding: '12px 20px 0', gap: 8 }}>
          {policies.map((policy) => (
            <button
              key={policy}
              type="button"
              className="chip"
              aria-pressed={!hidden.has(policy)}
              onClick={() => togglePolicy(policy)}
            >
              <span className={`key key-line${policy === 'never' ? ' dash' : ''}`} style={{ color: policyColor(policy) }} />
              {policyLabel(policy)}
            </button>
          ))}
          <span className="spacer" />
          <label className="row small ink2" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={showEvents} onChange={(event) => setShowEvents(event.target.checked)} />
            Show ▲ promotions / ✕ rollbacks
          </label>
        </div>
        <div className="chart-body">
          {weekly ? (
            <WeekChart
              ariaLabel={`Weekly ${measure.toUpperCase()} per policy over 92 weeks`}
              data={weekly}
              series={series}
              week0={week0}
              faults={meta.data?.faults}
              height={380}
              yDomain={[0, 'auto']}
              valueFormat={measure === 'wape' ? (value) => value.toFixed(3) : (value) => value.toFixed(1)}
              yFormat={measure === 'wape' ? (value) => String(+value.toFixed(2)) : (value) => String(Math.round(value))}
              xTickFormat={(week) => (week % 10 === 0 ? `${week}` : '')}
              tooltipExtra={(row) => {
                const marks = policies
                  .filter((policy) => !hidden.has(policy))
                  .flatMap((policy) => {
                    const event = eventsByPolicy.get(policy)?.get(row.week);
                    return event
                      ? [`${policyLabel(policy)}: ${event === 'promote' ? '▲ promotion' : '✕ rollback'}`]
                      : [];
                  });
                return marks.length ? (
                  <div className="tooltip-hint" style={{ color: 'var(--ink-2)' }}>
                    {marks.join(' · ')}
                  </div>
                ) : null;
              }}
            />
          ) : (
            <Skeleton h={380} />
          )}
          <div className="small muted" style={{ padding: '0 16px 8px' }}>
            Week 0 = {formatWeekStart(week0, 0)}; week 91 = {formatWeekStart(week0, 91)}.
          </div>
        </div>
      </ChartCard>

      <Scorecard c={comparison} pols={policies} />
      {comparison && <CompareNotes c={comparison} />}
    </div>
  );
}
