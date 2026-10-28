const DAY_MS = 86_400_000;

/** The date a replay week starts on, e.g. "28 Oct 2011". */
export function formatWeekStart(week0: string, week: number, options: { year?: boolean } = {}) {
  return new Date(Date.parse(`${week0}T00:00:00Z`) + week * 7 * DAY_MS).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(options.year === false ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  });
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '-';
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatNumber(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return '-';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPercent(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return '-';
  return `${(value * 100).toFixed(digits)}%`;
}

/** Few digits for any magnitude: 0.000012 → "1.2e-5", 0.4 → "0.400", 41 → "41.00", 1234 → "1234". */
export function formatValue(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '-';
  if (value === 0) return '0';
  const magnitude = Math.abs(value);
  if (magnitude < 0.001) return value.toExponential(1);
  if (magnitude < 1) return value.toFixed(3);
  if (magnitude < 100) return value.toFixed(2);
  return value.toFixed(0);
}

export function formatVersion(version: number | null | undefined) {
  return version == null ? '-' : `v${Math.round(version)}`;
}

export function humanize(name: string | null | undefined) {
  return name ? name.replace(/_/g, ' ') : '-';
}

export function formatAgo(iso: string) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return iso;
  const seconds = Math.round((Date.now() - time) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return formatDate(iso);
}
