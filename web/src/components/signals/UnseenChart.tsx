import { memo, useMemo } from 'react';
import type { Signals } from '../../api/types';
import { formatPercent } from '../../lib/format';
import { ChartCard } from '../ChartCard';
import { WeekChart } from '../charts/WeekChart';
import { CHART_HEIGHT, SYNC_ID, featureLegend, featureSeries, fillWeeks, type ChartContext } from './shared';

export const UnseenChart = memo(function UnseenChart({ s: signals, c: ctx }: { s: Signals; c: ChartContext }) {
  const data = useMemo(() => fillWeeks(ctx.nWeeks, signals.unseen.rows), [signals, ctx.nWeeks]);
  const unseenWeeks = signals.unseen.rows.filter((row) =>
    signals.unseen.features.some((feature) => (row[feature] ?? 0) > 0.05),
  ).length;

  return (
    <ChartCard
      title="3 · Unseen calendar values"
      sub="Share of rows whose month / season never appeared in training"
      explain={{
        seeing: (
          <>
            The share of this week's rows with a calendar value (month, season, …) the live model never saw in
            training.
          </>
        ),
        read: (
          <>
            Above <b>5%</b> counts as drift. PSI would just bin a June week with March, so calendar features use this
            check instead.
          </>
        ),
        notice: (
          <>
            {unseenWeeks} of {signals.unseen.rows.length} weeks bring a month or season the live model never trained
            on. That counts as drift, which on its own only means “watch”: a retrain also needs rising error.
          </>
        ),
      }}
    >
      {signals.unseen.features.length ? featureLegend(signals.unseen) : null}
      <div className="chart-body">
        {signals.unseen.features.length ? (
          <WeekChart
            ariaLabel="Unseen calendar value share by week"
            data={data}
            series={featureSeries(signals.unseen, { curve: 'step' })}
            week0={ctx.week0}
            faults={ctx.faults}
            shadeUntil={ctx.shadeUntil}
            threshold={{ y: 0.05, label: '5% limit' }}
            yDomain={[0, 1]}
            yTicks={[0, 0.25, 0.5, 0.75, 1]}
            yFormat={(value) => `${Math.round(value * 100)}%`}
            valueFormat={(value) => formatPercent(value)}
            syncId={SYNC_ID}
            selectedWeek={ctx.selectedWeek}
            onWeekClick={ctx.onWeekClick}
            height={CHART_HEIGHT}
          />
        ) : (
          <div className="empty" style={{ height: CHART_HEIGHT }}>
            No unseen calendar values in this run.
          </div>
        )}
      </div>
    </ChartCard>
  );
});
