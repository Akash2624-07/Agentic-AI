import { memo, type ReactElement, type ReactNode } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type LineProps,
} from 'recharts';
import type { Fault } from '../../api/types';
import { formatWeekStart } from '../../lib/format';

/** Marker drawn on a series point. */
export type DotKind = 'filled' | 'hollow' | 'promote' | 'rollback';

/** Rows are keyed by (possibly fractional) week. */
export interface ChartRow {
  week: number;
}

export interface Series<Row extends ChartRow = ChartRow> {
  key: string;
  /** Column to show in the tooltip when `key` holds a clamped value. */
  rawKey?: string;
  label: string;
  color: string;
  dash?: string;
  width?: number;
  curve?: LineProps['type'];
  connect?: boolean;
  dot?: (row: Row) => DotKind | null;
}

export interface Band {
  x1: number;
  x2: number;
  label: string;
  fill: string;
}

export interface WeekChartProps<Row extends ChartRow> {
  ariaLabel: string;
  data: Row[];
  series: Series<Row>[];
  week0: string;
  faults?: Fault[];
  /** Live mode: only shade faults up to this week. */
  shadeUntil?: number;
  bands?: Band[];
  xDomain?: [number, number];
  xTicks?: number[];
  xTickFormat?: (value: number) => string;
  yLog?: boolean;
  yDomain?: [number | 'auto', number | 'auto'];
  yTicks?: number[];
  yFormat?: (value: number) => string;
  yLabel?: string;
  threshold?: { y: number; label: string };
  selectedWeek?: number | null;
  valueFormat?: (value: number) => string;
  titleFor?: (row: Row) => ReactNode;
  tooltipExtra?: (row: Row) => ReactNode;
  onWeekClick?: (week: number) => void;
  syncId?: string;
  height?: number;
}

interface SeriesDotProps {
  cx?: number;
  cy?: number;
  kind: DotKind | null;
  color: string;
}

function SeriesDot({ cx, cy, kind, color }: SeriesDotProps) {
  if (cx === undefined || cy === undefined || !kind || Number.isNaN(cy)) return null;
  const halo = 'var(--surface)';
  switch (kind) {
    case 'filled':
      return <circle cx={cx} cy={cy} r={4} fill={color} stroke={halo} strokeWidth={2} />;
    case 'hollow':
      return <circle cx={cx} cy={cy} r={4.5} fill="var(--surface)" stroke={color} strokeWidth={2} />;
    case 'promote':
      return (
        <path
          d={`M${cx},${cy - 6} L${cx + 5.5},${cy + 4} L${cx - 5.5},${cy + 4} Z`}
          fill={color}
          stroke={halo}
          strokeWidth={1.5}
        />
      );
    case 'rollback':
      return (
        <g stroke={color} strokeWidth={2.5} strokeLinecap="round">
          <circle cx={cx} cy={cy} r={7} fill={halo} stroke="none" />
          <path d={`M${cx - 4},${cy - 4} L${cx + 4},${cy + 4} M${cx + 4},${cy - 4} L${cx - 4},${cy + 4}`} />
        </g>
      );
  }
}

const defaultValueFormat = (value: number) =>
  Math.abs(value) >= 100 ? value.toFixed(0) : Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2);

const faultLabel = (kind: string) =>
  kind === 'temp_celsius' ? 'temp in °C' : kind === 'hum_missing' ? 'hum missing' : kind;

function WeekChartImpl<Row extends ChartRow>(props: WeekChartProps<Row>) {
  const valueFormat = props.valueFormat ?? defaultValueFormat;
  const lastWeek = props.data.length ? props.data[props.data.length - 1].week : 0;
  const xDomain = props.xDomain ?? [-0.5, lastWeek + 0.5];
  const faults = (props.faults ?? []).filter(
    (fault) => props.shadeUntil === undefined || fault.start <= props.shadeUntil,
  );

  return (
    <div role="img" aria-label={props.ariaLabel} style={{ width: '100%', height: props.height ?? 240 }}>
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 600, height: props.height ?? 240 }}
      >
        <LineChart
          data={props.data}
          syncId={props.syncId}
          margin={{ top: 18, right: 16, bottom: 4, left: 4 }}
          onClick={
            props.onWeekClick
              ? (state) => {
                  const index = Number(state?.activeTooltipIndex);
                  if (Number.isFinite(index) && props.data[index]) props.onWeekClick!(props.data[index].week);
                }
              : undefined
          }
          style={props.onWeekClick ? { cursor: 'pointer' } : undefined}
        >
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          {props.bands?.map((band) => (
            <ReferenceArea
              key={band.label}
              x1={band.x1}
              x2={band.x2}
              fill={band.fill}
              fillOpacity={1}
              ifOverflow="hidden"
              label={{ value: band.label, position: 'insideTopLeft', fill: 'var(--ink-2)', fontSize: 11 }}
            />
          ))}
          {faults.map((fault) => (
            <ReferenceArea
              key={fault.kind}
              x1={fault.start - 0.5}
              x2={Math.min(fault.end, props.shadeUntil ?? fault.end) + 0.5}
              fill="var(--fault-fill)"
              fillOpacity={1}
              ifOverflow="hidden"
              label={{
                value: faultLabel(fault.kind),
                position: 'insideTop',
                fill: 'var(--fault-ink)',
                fontSize: 11,
                fontWeight: 600,
                dy: -14,
              }}
            />
          ))}
          <XAxis
            dataKey="week"
            type="number"
            domain={xDomain}
            allowDataOverflow
            ticks={props.xTicks ?? defaultTicks(xDomain)}
            tickFormatter={props.xTickFormat}
            tickLine={false}
            axisLine={{ stroke: 'var(--axis)' }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            scale={props.yLog ? 'log' : 'auto'}
            domain={props.yDomain ?? [0, 'auto']}
            allowDataOverflow={!!props.yDomain || props.yLog}
            ticks={props.yTicks}
            tickFormatter={props.yFormat}
            tickLine={false}
            axisLine={false}
            width={44}
            label={
              props.yLabel
                ? {
                    value: props.yLabel,
                    angle: -90,
                    position: 'insideLeft',
                    offset: 10,
                    style: { textAnchor: 'middle', fill: 'var(--muted)', fontSize: 11 },
                  }
                : undefined
            }
          />
          {props.threshold && (
            <ReferenceLine
              y={props.threshold.y}
              stroke="var(--ink-2)"
              strokeDasharray="4 3"
              strokeWidth={1.25}
              ifOverflow="extendDomain"
              label={{
                value: props.threshold.label,
                position: 'insideBottomRight',
                fill: 'var(--ink-2)',
                fontSize: 11,
              }}
            />
          )}
          {props.selectedWeek !== null && props.selectedWeek !== undefined && (
            <ReferenceLine x={props.selectedWeek} stroke="var(--accent)" strokeWidth={2} ifOverflow="hidden" />
          )}
          <Tooltip
            content={(tooltip) => {
              if (!tooltip.active || !tooltip.payload?.length) return null;
              const row: Row = tooltip.payload[0].payload;
              const values = row as unknown as Record<string, number | null | undefined>;
              const week = Math.round(row.week);
              const fault = (props.faults ?? []).find(
                (f) =>
                  week >= f.start &&
                  week <= f.end &&
                  (props.shadeUntil === undefined || week <= props.shadeUntil),
              );
              const shown = props.series
                .map((series) => ({ series, value: values[series.rawKey ?? series.key] }))
                .filter((entry): entry is { series: Series<Row>; value: number } =>
                  entry.value !== null && entry.value !== undefined,
                )
                .sort((a, b) => b.value - a.value);
              return (
                <div className="tooltip">
                  <div className="tooltip-title">
                    {props.titleFor ? (
                      props.titleFor(row)
                    ) : (
                      <>
                        <span>Week {row.week}</span>
                        <span className="muted" style={{ fontWeight: 500 }}>
                          {formatWeekStart(props.week0, row.week)}
                        </span>
                      </>
                    )}
                  </div>
                  {shown.length === 0 && <div className="muted">no value this week</div>}
                  {shown.slice(0, 8).map(({ series, value }) => (
                    <div key={series.key} className="tooltip-row">
                      <span className={`key-line${series.dash ? ' dash' : ''}`} style={{ color: series.color }} />
                      <span className="v">{valueFormat(value)}</span>
                      <span className="n">{series.label}</span>
                    </div>
                  ))}
                  {props.tooltipExtra?.(row)}
                  {fault && <div className="tooltip-note">Injected fault: {fault.kind}</div>}
                  {props.onWeekClick && <div className="tooltip-hint">Click for this week's details</div>}
                </div>
              );
            }}
            cursor={{ stroke: 'var(--ink-2)', strokeWidth: 1 }}
            isAnimationActive={false}
            allowEscapeViewBox={{ x: false, y: true }}
            wrapperStyle={{ zIndex: 5, outline: 'none' }}
          />
          {props.series.map((series) => (
            <Line
              key={series.key}
              dataKey={series.key}
              name={series.label}
              type={series.curve ?? 'linear'}
              stroke={series.color}
              strokeWidth={series.width ?? 2}
              strokeDasharray={series.dash}
              strokeLinecap="round"
              strokeLinejoin="round"
              connectNulls={series.connect}
              isAnimationActive={false}
              dot={
                series.dot
                  ? (dot) => (
                      <SeriesDot
                        key={`${series.key}-${dot.index}`}
                        cx={dot.cx}
                        cy={dot.cy}
                        color={series.color}
                        kind={dot.payload ? series.dot!(dot.payload) : null}
                      />
                    )
                  : false
              }
              activeDot={{ r: 4.5, stroke: 'var(--surface)', strokeWidth: 2, fill: series.color }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Whole-week ticks, thinned to every 2, 5 or 10 weeks on wider domains. */
function defaultTicks([min, max]: [number, number]) {
  const first = Math.ceil(min);
  const last = Math.floor(max);
  const span = last - first;
  const step = span > 60 ? 10 : span > 25 ? 5 : span > 10 ? 2 : 1;
  const ticks: number[] = [];
  for (let tick = Math.ceil(first / step) * step; tick <= last; tick += step) ticks.push(tick);
  return ticks;
}

// memo() drops the type parameter, so restore it.
export const WeekChart = memo(WeekChartImpl) as <Row extends ChartRow>(props: WeekChartProps<Row>) => ReactElement;
