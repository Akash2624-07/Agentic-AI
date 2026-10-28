import type { Fault, SignalBlock, SignalRow } from '../../api/types';
import { featureColor, featureLabel } from '../../lib/features';
import { ChartLegend } from '../charts/ChartLegend';
import type { Series } from '../charts/WeekChart';

/** Hovering one signal chart moves the cursor on the others. */
export const SYNC_ID = 'signals';
export const CHART_HEIGHT = 230;

/** What every signal chart of a run shares. */
export interface ChartContext {
  week0: string;
  faults: Fault[];
  nWeeks: number;
  selectedWeek: number | null;
  onWeekClick: (week: number) => void;
  /** Live sessions only shade the faults the stream has reached. */
  shadeUntil?: number;
}

export function inFault(faults: Fault[], week: number) {
  return faults.some((fault) => week >= fault.start && week <= fault.end);
}

/** One row per week 0..nWeeks-1, so weeks without data still take their place on the x axis. */
export function fillWeeks<Source extends { week: number }, Row extends object = Source>(
  nWeeks: number,
  rows: Source[],
  map?: (row: Source) => Row,
): Array<{ week: number } & Partial<Row>> {
  const byWeek = new Map(rows.map((row) => [row.week, row]));
  return Array.from({ length: nWeeks }, (_, week) => {
    const row = byWeek.get(week);
    return { week, ...(row ? (map ? map(row) : row) : {}) } as { week: number } & Partial<Row>;
  });
}

export function featureSeries(block: SignalBlock, extra?: Partial<Series<SignalRow>>): Series<SignalRow>[] {
  return block.features.map((feature) => ({
    key: feature,
    label: featureLabel(feature),
    color: featureColor(feature),
    ...extra,
    ...(extra?.rawKey ? { rawKey: `${feature}__raw` } : {}),
  }));
}

export function featureLegend(block: SignalBlock) {
  return (
    <ChartLegend items={block.features.map((feature) => ({ label: featureLabel(feature), color: featureColor(feature) }))} />
  );
}

/** Highest value of a feature inside the given fault windows, and outside them. */
export function peakInsideOutside(block: SignalBlock, feature: string, faults: Fault[]) {
  let inside = 0;
  let outside = 0;
  for (const row of block.rows) {
    const value = row[feature];
    if (value == null) continue;
    if (inFault(faults, row.week)) {
      if (value > inside) inside = value;
    } else if (value > outside) {
      outside = value;
    }
  }
  return { inside, outside };
}

export const faultWeeks = (fault: Fault) => `weeks ${fault.start}–${fault.end}`;
