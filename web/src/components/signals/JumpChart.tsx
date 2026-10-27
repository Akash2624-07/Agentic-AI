import { memo, useMemo } from 'react';
import type { Signals } from '../../api/types';
import { ChartCard } from '../ChartCard';
import { WeekChart } from '../charts/WeekChart';
import {
  CHART_HEIGHT,
  SYNC_ID,
  faultWeeks,
  featureLegend,
  featureSeries,
  fillWeeks,
  inFault,
  peakInsideOutside,
  type ChartContext,
} from './shared';

/** Bottom of the log axis; smaller jumps are drawn on it (the tooltip shows the real value). */
const LOG_FLOOR = 0.05;

export const JumpChart = memo(function JumpChart({ s: signals, c: ctx }: { s: Signals; c: ChartContext }) {
  const data = useMemo(
    () =>
      fillWeeks(ctx.nWeeks, signals.jump.rows, (row) => {
        const values: Record<string, number | null> = {};
        for (const feature of signals.jump.features) {
          const value = row[feature];
          values[`${feature}__raw`] = value ?? null;
          values[feature] = value == null ? null : Math.max(LOG_FLOOR, value);
        }
        return values;
      }),
    [signals, ctx.nWeeks],
  );

  const faultNotes = ctx.faults.flatMap((fault) => {
    if (!signals.jump.features.includes(fault.feature)) return [];
    const { inside } = peakInsideOutside(signals.jump, fault.feature, [fault]);
    if (inside <= 3) return [];
    return [
      <span key={fault.kind}>
        <b>{fault.feature}</b>
        {' jumps '}
        {inside.toFixed(0)}
        {' std in '}
        {faultWeeks(fault)}
        {'.'}
        {' '}
      </span>,
    ];
  });

  let cleanMax = 0;
  for (const row of signals.jump.rows) {
    if (inFault(ctx.faults, row.week)) continue;
    for (const feature of signals.jump.features) cleanMax = Math.max(cleanMax, row[feature] ?? 0);
  }

  return (
    <ChartCard
      title="4 · Sudden jump"
      sub="|change in weekly mean| ÷ training std, per normalised feature (log scale)"
      explain={{
        seeing: (
          <>
            How far each feature's weekly average moved since the last clean week, in training standard deviations.
            The axis is logarithmic.
          </>
        ),
        read: (
          <>
            Above <b>3 = a sudden jump</b>. Seasons move the average slowly; a broken feed moves it all at once.
          </>
        ),
        notice: (
          <>
            {faultNotes}
            Outside the faults, no feature moves more than {cleanMax.toFixed(1)} std in a week. A missing feed shows up
            in quality, not here.
          </>
        ),
      }}
    >
      {featureLegend(signals.jump)}
      <div className="chart-body">
        <WeekChart
          ariaLabel="Weekly mean jump in training standard deviations, log scale"
          data={data}
          series={featureSeries(signals.jump, { rawKey: 'raw' })}
          week0={ctx.week0}
          faults={ctx.faults}
          shadeUntil={ctx.shadeUntil}
          threshold={{ y: 3, label: 'jump above 3' }}
          yLog
          yDomain={[LOG_FLOOR, 200]}
          yTicks={[0.1, 1, 3, 10, 100]}
          yFormat={(value) => `${value}`}
          valueFormat={(value) => `${value < 1 ? value.toFixed(2) : value.toFixed(1)} std`}
          syncId={SYNC_ID}
          selectedWeek={ctx.selectedWeek}
          onWeekClick={ctx.onWeekClick}
          height={CHART_HEIGHT}
        />
      </div>
    </ChartCard>
  );
});
