import type { ReactNode } from 'react';
import type { Fault } from '../../api/types';
import type { Band } from '../charts/WeekChart';

const DAY_MS = 86_400_000;

/**
 * Position of a day on the week axis. Week w covers [w - 0.5, w + 0.5), so a day
 * sits at its offset into that week (plus half a day, to centre it).
 */
export function weekPosition(week0: string, date: string) {
  return (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${week0}T00:00:00Z`)) / DAY_MS / 7 - 0.5 + 1 / 14;
}

/** "Fri, 28 Oct 2011" */
export function longDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** A day of /dataset/daily placed on the week axis. */
export interface DayPoint {
  /** Fractional position on the week axis. */
  week: number;
  date: string;
  /** The data week the day belongs to (negative in training). */
  wk: number;
  cnt: number;
  temp: number | null;
  temp_delivered: number | null;
  hum: number | null;
  hum_delivered: number | null;
  fault: string[];
}

/** What the daily charts share: axis, ticks, bands and tooltip title. */
export interface DailyChartCommon {
  week0: string;
  faults: Fault[];
  xDomain: [number, number];
  ticks: Array<{ x: number; label: string }>;
  tickLabel: (x: number) => string;
  title: (day: DayPoint) => ReactNode;
  trainBand: Band[];
}
