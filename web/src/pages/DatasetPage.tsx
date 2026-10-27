import { useMemo } from 'react';
import { useDatasetDaily, useDatasetSummary, useMeta } from '../api/queries';
import { ChartCard } from '../components/ChartCard';
import { ChartLegend } from '../components/charts/ChartLegend';
import { WeekChart, type Band } from '../components/charts/WeekChart';
import { ColumnsCard } from '../components/dataset/ColumnsCard';
import { longDate, weekPosition, type DailyChartCommon, type DayPoint } from '../components/dataset/daily';
import { DatasetStats } from '../components/dataset/DatasetStats';
import { DemandNotice } from '../components/dataset/DemandNotice';
import { HumidityChart } from '../components/dataset/HumidityChart';
import { RowBrowser } from '../components/dataset/RowBrowser';
import { TemperatureChart } from '../components/dataset/TemperatureChart';
import { ErrorBox } from '../components/ErrorBox';
import { PageHead } from '../components/PageHead';
import { Skeleton } from '../components/Skeleton';

export default function DatasetPage() {
  const meta = useMeta();
  const summary = useDatasetSummary();
  const daily = useDatasetDaily();
  const week0 = meta.data?.week0 ?? '2011-04-01';
  const faults = meta.data?.faults ?? [];
  const dataset = summary.data;

  const days = useMemo<DayPoint[]>(
    () =>
      (daily.data ?? []).map((day) => ({
        week: weekPosition(week0, day.date),
        date: day.date,
        wk: day.week,
        cnt: day.cnt,
        temp: day.temp,
        temp_delivered: day.temp_delivered,
        hum: day.hum,
        hum_delivered: day.hum_delivered,
        fault: day.fault,
      })),
    [daily.data, week0],
  );

  // A tick at the start of every quarter of 2011 and 2012.
  const ticks = useMemo(() => {
    const quarters: Array<{ x: number; label: string }> = [];
    for (const year of [2011, 2012]) {
      for (const month of [1, 4, 7, 10]) {
        const date = `${year}-${String(month).padStart(2, '0')}-01`;
        quarters.push({
          x: weekPosition(week0, date),
          label: new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
            month: 'short',
            year: '2-digit',
            timeZone: 'UTC',
          }),
        });
      }
    }
    return quarters;
  }, [week0]);

  const tickLabel = (x: number) => ticks.find((tick) => Math.abs(tick.x - x) < 1e-6)?.label ?? '';
  const xDomain: [number, number] = [-13.5, (meta.data?.n_weeks ?? 92) - 0.5];
  const trainBand: Band[] = [{ x1: -13.5, x2: -0.5, label: 'training window', fill: 'var(--train-fill)' }];
  const dayTitle = (day: DayPoint) => (
    <>
      <span>{longDate(day.date)}</span>
      <span className="muted" style={{ fontWeight: 500 }}>
        {day.wk < 0 ? 'training' : `week ${day.wk}`}
      </span>
    </>
  );
  const common: DailyChartCommon = {
    week0,
    faults,
    xDomain,
    ticks,
    tickLabel,
    title: dayTitle,
    trainBand,
  };

  return (
    <div className="stack-lg">
      <PageHead eyebrow="Dataset" title="Two years of bike rentals, replayed one week at a time">
        {dataset ? dataset.name : 'UCI Bike Sharing (hourly), Capital Bikeshare, Washington D.C., 2011–2012'}
        {'. The model predicts '}
        <code>cnt</code>
        {', the rentals in each hour.'}
      </PageHead>
      {summary.isError && <ErrorBox error={summary.error} what="the dataset summary" />}
      <DatasetStats />
      <ChartCard
        title="Demand over time"
        sub="Total rentals per day"
        explain={{
          seeing: (
            <>
              Daily rentals for both years. Blue band: the Jan–Mar 2011 training window. After it, 92 weeks are
              replayed one at a time.
            </>
          ),
          read: (
            <>
              Red bands are the two injected pipeline faults. Each replayed week's true counts reach the loop one week
              late.
            </>
          ),
          notice: <DemandNotice daily={daily.data} />,
        }}
      >
        <ChartLegend items={[{ label: 'rentals per day', color: 'var(--s1)' }]} />
        <div className="chart-body">
          {daily.data ? (
            <WeekChart
              ariaLabel="Daily bike rentals, January 2011 to December 2012"
              data={days}
              series={[{ key: 'cnt', label: 'rentals', color: 'var(--s1)', width: 1.5 }]}
              week0={week0}
              faults={faults}
              bands={trainBand}
              xDomain={xDomain}
              xTicks={ticks.map((tick) => tick.x)}
              xTickFormat={tickLabel}
              yFormat={(value) => (value >= 1000 ? `${value / 1000}k` : String(value))}
              valueFormat={(value) => value.toLocaleString('en-US')}
              titleFor={dayTitle}
              height={300}
            />
          ) : daily.isError ? (
            <ErrorBox error={daily.error} what="the daily series" />
          ) : (
            <Skeleton h={300} />
          )}
        </div>
      </ChartCard>
      <section className="stack">
        <div>
          <h2>What the model sees vs the truth</h2>
          <p className="ink2" style={{ marginTop: 6, maxWidth: 780 }}>
            The pipeline delivers inputs to the model; the faults corrupt them on the way. Solid lines are what was
            delivered, dashed lines the real values. The loop only ever sees the solid line.
          </p>
        </div>
        <div className="grid-2">
          <TemperatureChart rows={days} loading={!daily.data} common={common} />
          <HumidityChart rows={days} loading={!daily.data} common={common} />
        </div>
      </section>
      <ColumnsCard />
      <RowBrowser />
    </div>
  );
}
