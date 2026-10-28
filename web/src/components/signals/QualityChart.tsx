import { memo, useMemo } from 'react';
import type { Signals } from '../../api/types';
import { formatPercent } from '../../lib/format';
import { ChartCard } from '../ChartCard';
import { WeekChart } from '../charts/WeekChart';
import {
  CHART_HEIGHT,
  SYNC_ID,
  faultWeeks,
  featureLegend,
  featureSeries,
  fillWeeks,
  peakInsideOutside,
  type ChartContext,
} from './shared';

export const QualityChart = memo(function QualityChart({ s: signals, c: ctx }: { s: Signals; c: ChartContext }) {
  const data = useMemo(() => fillWeeks(ctx.nWeeks, signals.quality.rows), [signals, ctx.nWeeks]);

  const faultNotes = ctx.faults.flatMap((fault) => {
    if (!signals.quality.features.includes(fault.feature)) return [];
    const { inside, outside } = peakInsideOutside(signals.quality, fault.feature, [fault]);
    const elsewhere = peakInsideOutside(signals.quality, fault.feature, ctx.faults).outside;
    return [
      <span key={fault.kind}>
        <b>{fault.feature}</b>
        {': '}
        {formatPercent(inside)}
        {' in '}
        {faultWeeks(fault)}
        {', '}
        {elsewhere === 0 ? '0% in every other week' : `at most ${formatPercent(elsewhere, 1)} elsewhere`}
        {'.'}
        {' '}
        {outside === 0 && inside > 0.5 ? 'A step, not a trend. ' : ''}
      </span>,
    ];
  });

  return (
    <ChartCard
      title="1 · Data quality"
      sub="Missing or out-of-range share of rows, per feature"
      explain={{
        seeing: (
          <>
            The share of this week's rows that are missing or outside the feature's valid range ([0, 1] for
            normalised features). Only features that ever fail are drawn.
          </>
        ),
        read: (
          <>
            Dashed line = the <b>5% limit</b>. Above it the batch fails quality: the right response is an alert, and
            retraining on it is blocked.
          </>
        ),
        notice: faultNotes.length ? (
          <>
            {faultNotes}
            {' Seasons never break this check; broken feeds do.'}
          </>
        ) : (
          <>No feature ever failed the quality check in this run.</>
        ),
      }}
    >
      {featureLegend(signals.quality)}
      <div className="chart-body">
        <WeekChart
          ariaLabel="Data quality failure share per feature by week"
          data={data}
          series={featureSeries(signals.quality, { curve: 'step' })}
          week0={ctx.week0}
          faults={ctx.faults}
          shadeUntil={ctx.shadeUntil}
          threshold={{ y: 0.05, label: '5% limit' }}
          yDomain={[0, 1]}
          yTicks={[0, 0.25, 0.5, 0.75, 1]}
          yFormat={(value) => `${Math.round(value * 100)}%`}
          valueFormat={(value) => formatPercent(value, value > 0 && value < 0.1 ? 1 : 0)}
          syncId={SYNC_ID}
          selectedWeek={ctx.selectedWeek}
          onWeekClick={ctx.onWeekClick}
          height={CHART_HEIGHT}
        />
      </div>
    </ChartCard>
  );
});
