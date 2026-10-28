import { useMemo } from 'react';
import type { ErrorPoint, Meta } from '../../api/types';
import { ChartCard } from '../ChartCard';
import { ChartLegend } from '../charts/ChartLegend';
import { WeekChart } from '../charts/WeekChart';
import { SYNC_ID, fillWeeks, type ChartContext } from './shared';

/** Ratios above this are drawn at the top of the axis and listed under the chart. */
const RATIO_CAP = 4;

function errorRows(nWeeks: number, error: ErrorPoint[], cap: number) {
  return fillWeeks(nWeeks, error, (point) => ({
    ratio: point.ratio === null ? null : Math.min(point.ratio, cap),
    ratio__raw: point.ratio,
    wape: point.wape,
    version: point.version,
    quality_ok: point.quality_ok,
  }));
}

interface ErrorChartProps {
  error: ErrorPoint[];
  c: ChartContext;
  meta: Meta | undefined;
  height?: number;
  /** Just the chart, without its card (the Live page wraps it in its own). */
  compact?: boolean;
  xDomain?: [number, number];
}

export function ErrorChart({ error, c: ctx, meta, height = 260, compact, xDomain }: ErrorChartProps) {
  const threshold = meta?.thresholds.error_ratio ?? 1.25;
  const data = useMemo(() => errorRows(ctx.nWeeks, error, RATIO_CAP), [error, ctx.nWeeks]);
  const offScale = error.filter((point) => (point.ratio ?? 0) > RATIO_CAP);

  const chart = (
    <WeekChart
      ariaLabel="Error ratio of the live model on each labelled week"
      data={data}
      series={[
        {
          key: 'ratio',
          rawKey: 'ratio__raw',
          label: 'error ratio',
          color: 'var(--s1)',
          connect: true,
          width: 1.5,
          dot: (row) =>
            row.ratio === null || row.ratio === undefined ? null : row.quality_ok === false ? 'hollow' : 'filled',
        },
      ]}
      week0={ctx.week0}
      faults={ctx.faults}
      shadeUntil={ctx.shadeUntil}
      threshold={{ y: threshold, label: `alert: 2 clean weeks above ${threshold}` }}
      yDomain={[0, 4]}
      yTicks={[0, 1, 2, 3, 4]}
      valueFormat={(value) => `${value.toFixed(2)}×`}
      yFormat={(value) => `${value}×`}
      syncId={compact ? undefined : SYNC_ID}
      selectedWeek={ctx.selectedWeek}
      onWeekClick={ctx.onWeekClick}
      height={height}
      xDomain={xDomain}
      tooltipExtra={(row) =>
        row.ratio__raw === null || row.ratio__raw === undefined ? null : (
          <div className="tooltip-hint" style={{ color: 'var(--ink-2)' }}>
            WAPE {row.wape?.toFixed(3)} · model v{row.version}
            {row.quality_ok === false && (
              <div style={{ color: 'var(--fault-ink)' }}>faulty inputs: ignored by the alert</div>
            )}
          </div>
        )
      }
    />
  );

  const legend = (
    <ChartLegend
      items={[
        {
          label: 'clean labelled week',
          color: 'var(--s1)',
          marker: (
            <svg width="12" height="12">
              <circle cx="6" cy="6" r="4" fill="var(--s1)" />
            </svg>
          ),
        },
        {
          label: 'faulty week (ignored by the alert)',
          color: 'var(--s1)',
          marker: (
            <svg width="12" height="12">
              <circle cx="6" cy="6" r="4" fill="none" stroke="var(--s1)" strokeWidth="2" />
            </svg>
          ),
        },
      ]}
    />
  );

  const offScaleNote = offScale.length ? (
    <div className="small muted" style={{ padding: '0 16px 10px' }}>
      Off the top of the scale: {offScale.map((point) => `week ${point.week} (${point.ratio!.toFixed(1)}×)`).join(', ')}.
    </div>
  ) : null;

  if (compact) {
    return (
      <>
        {legend}
        <div className="chart-body">{chart}</div>
        {offScaleNote}
      </>
    );
  }

  return (
    <ChartCard
      title="5 · Model error on labelled weeks"
      sub="The live model's WAPE ÷ its own baseline WAPE"
      explain={{
        seeing: (
          <>
            Each dot is a week whose true counts have arrived (one week late): the live model's error relative to its
            own baseline.
          </>
        ),
        read: (
          <>
            Above <b>{threshold}× for 2 clean weeks</b> = error alert. Hollow dots are weeks with faulty inputs; the
            alert ignores them.
          </>
        ),
        notice: (
          <>
            The faults barely move the error, so error alone can't diagnose them. But it is the only signal that sees
            demand growing through 2012; input drift misses it.
          </>
        ),
      }}
    >
      {legend}
      <div className="chart-body">{chart}</div>
      {offScaleNote}
    </ChartCard>
  );
}
