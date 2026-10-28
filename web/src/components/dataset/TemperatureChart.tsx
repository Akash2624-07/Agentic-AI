import { useState } from 'react';
import { ChartCard } from '../ChartCard';
import { ChartLegend } from '../charts/ChartLegend';
import { WeekChart, type Series } from '../charts/WeekChart';
import { Segmented } from '../Segmented';
import { Skeleton } from '../Skeleton';
import type { DailyChartCommon, DayPoint } from './daily';

type Scale = 'log' | 'linear';

interface DailyChartProps {
  rows: DayPoint[];
  loading: boolean;
  common: DailyChartCommon;
}

export function TemperatureChart({ rows, loading, common }: DailyChartProps) {
  const [scale, setScale] = useState<Scale>('log');
  const fault = common.faults.find((f) => f.kind === 'temp_celsius');
  const faultDays = rows.filter((row) => fault && row.wk >= fault.start && row.wk <= fault.end);
  const highest = Math.max(0, ...faultDays.map((row) => row.temp_delivered ?? 0));
  const lowest = Math.min(...faultDays.map((row) => row.temp_delivered ?? Infinity));
  const series: Series<DayPoint>[] = [
    { key: 'temp', label: 'true temp', color: 'var(--ink-2)', dash: '4 3', width: 1.5 },
    { key: 'temp_delivered', label: 'delivered temp', color: 'var(--s1)', width: 1.75 },
  ];

  return (
    <ChartCard
      title="Temperature (normalised)"
      sub="Daily mean, delivered vs true"
      right={
        <Segmented
          label="Y scale"
          value={scale}
          onChange={setScale}
          options={[
            { value: 'log', label: 'Log' },
            { value: 'linear', label: 'Linear 0–1' },
          ]}
        />
      }
      explain={{
        seeing: (
          <>
            Daily mean <code>temp</code>: what the model received (solid) and the real value (dashed).
          </>
        ),
        read: (
          <>
            {'Valid values lie in [0, 1] (°C ÷ 41). '}
            {scale === 'log' ? 'The log axis fits both scales.' : 'Linear view: the °C values are off the top.'}
          </>
        ),
        notice: fault ? (
          <>
            In weeks {fault.start}–{fault.end} the delivered value jumps to {lowest.toFixed(0)}–{highest.toFixed(0)}:
            degrees Celsius, 41× the truth. A season never does that; the quality and jump checks catch it the same
            week.
          </>
        ) : (
          <>No temperature fault is configured.</>
        ),
      }}
    >
      <ChartLegend items={series.map((s) => ({ label: s.label, color: s.color, dash: !!s.dash }))} />
      <div className="chart-body">
        {loading ? (
          <Skeleton h={250} />
        ) : (
          <WeekChart
            ariaLabel="Daily mean temperature, delivered versus true"
            data={rows}
            series={series}
            week0={common.week0}
            faults={common.faults}
            bands={common.trainBand}
            xDomain={common.xDomain}
            xTicks={common.ticks.map((tick) => tick.x)}
            xTickFormat={common.tickLabel}
            titleFor={common.title}
            yLog={scale === 'log'}
            yDomain={scale === 'log' ? [0.03, 40] : [0, 1.1]}
            yTicks={scale === 'log' ? [0.1, 1, 10] : [0, 0.25, 0.5, 0.75, 1]}
            threshold={{ y: 1, label: 'valid max 1' }}
            valueFormat={(value) => value.toFixed(2)}
            height={250}
          />
        )}
      </div>
    </ChartCard>
  );
}
