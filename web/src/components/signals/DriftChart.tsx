import { memo, useMemo } from 'react';
import type { Signals } from '../../api/types';
import { ChartCard } from '../ChartCard';
import { WeekChart } from '../charts/WeekChart';
import { CHART_HEIGHT, SYNC_ID, featureLegend, featureSeries, fillWeeks, inFault, type ChartContext } from './shared';

export const DriftChart = memo(function DriftChart({ s: signals, c: ctx }: { s: Signals; c: ChartContext }) {
  const data = useMemo(() => fillWeeks(ctx.nWeeks, signals.drift.rows), [signals, ctx.nWeeks]);
  const driftedWeeks = signals.drift.rows.filter((row) =>
    signals.drift.features.some((feature) => (row[feature] ?? 0) > 1),
  );
  const cleanDriftedWeeks = driftedWeeks.filter((row) => !inFault(ctx.faults, row.week)).length;

  return (
    <ChartCard
      title="2 · Drift (weather features)"
      sub="PSI against the live model's training window ÷ that feature's threshold"
      explain={{
        seeing: (
          <>
            How different each weather feature looks from the live model's training data (PSI), divided by a
            threshold calibrated on that model's own week-to-week noise.
          </>
        ),
        read: (
          <>
            Above <b>1 = drifted</b>: more different than a normal week. The reference changes each time a new model
            is promoted.
          </>
        ),
        notice: (
          <>
            Drift fired in {driftedWeeks.length} weeks, {cleanDriftedWeeks} of them with no fault at all. Drift alone
            can't tell a season from a bug; quality and jump can.
          </>
        ),
      }}
    >
      {featureLegend(signals.drift)}
      <div className="chart-body">
        <WeekChart
          ariaLabel="Drift ratio per weather feature by week"
          data={data}
          series={featureSeries(signals.drift)}
          week0={ctx.week0}
          faults={ctx.faults}
          shadeUntil={ctx.shadeUntil}
          threshold={{ y: 1, label: 'drifted above 1' }}
          valueFormat={(value) => `${value.toFixed(2)}×`}
          yFormat={(value) => `${value}`}
          syncId={SYNC_ID}
          selectedWeek={ctx.selectedWeek}
          onWeekClick={ctx.onWeekClick}
          height={CHART_HEIGHT}
        />
      </div>
    </ChartCard>
  );
});
