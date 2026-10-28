import { ChartCard } from '../ChartCard';
import { ChartLegend } from '../charts/ChartLegend';
import { WeekChart, type Series } from '../charts/WeekChart';
import { Skeleton } from '../Skeleton';
import type { DailyChartCommon, DayPoint } from './daily';

interface DailyChartProps {
  rows: DayPoint[];
  loading: boolean;
  common: DailyChartCommon;
}

export function HumidityChart({ rows, loading, common }: DailyChartProps) {
  const fault = common.faults.find((f) => f.kind === 'hum_missing');
  const series: Series<DayPoint>[] = [
    { key: 'hum', label: 'true humidity', color: 'var(--ink-2)', dash: '4 3', width: 1.5 },
    { key: 'hum_delivered', label: 'delivered humidity', color: 'var(--s3)', width: 1.75 },
  ];

  return (
    <ChartCard
      title="Humidity (normalised)"
      sub="Daily mean, delivered vs true"
      explain={{
        seeing: (
          <>
            Daily mean <code>hum</code>: delivered (solid) and true (dashed). A gap means the feed sent nothing.
          </>
        ),
        read: <>Valid values lie in [0, 1] (% ÷ 100). Missing values count against the 5% quality limit.</>,
        notice: fault ? (
          <>
            In weeks {fault.start}–{fault.end} the solid line stops: the feed is empty. Same symptom as drift (inputs
            unlike training), opposite fix: repair the feed, don't retrain on it.
          </>
        ) : (
          <>No humidity fault is configured.</>
        ),
      }}
    >
      <ChartLegend items={series.map((s) => ({ label: s.label, color: s.color, dash: !!s.dash }))} />
      <div className="chart-body">
        {loading ? (
          <Skeleton h={250} />
        ) : (
          <WeekChart
            ariaLabel="Daily mean humidity, delivered versus true"
            data={rows}
            series={series}
            week0={common.week0}
            faults={common.faults}
            bands={common.trainBand}
            xDomain={common.xDomain}
            xTicks={common.ticks.map((tick) => tick.x)}
            xTickFormat={common.tickLabel}
            titleFor={common.title}
            yDomain={[0, 1]}
            yTicks={[0, 0.25, 0.5, 0.75, 1]}
            valueFormat={(value) => value.toFixed(2)}
            tooltipExtra={(row) =>
              row.hum_delivered === null && row.hum !== null ? (
                <div className="tooltip-note">delivered: empty</div>
              ) : null
            }
            height={250}
          />
        )}
      </div>
    </ChartCard>
  );
}
