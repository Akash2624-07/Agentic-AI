import type { Comparison, ComparisonMetric, MetricValue } from '../api/types';

export function findMetric(comparison: Comparison | undefined, key: string) {
  return comparison?.metrics.find((metric) => metric.key === key);
}

export function metricValue(comparison: Comparison | undefined, key: string, policy: string) {
  return findMetric(comparison, key)?.values[policy];
}

/** Sums the "hit/total" values of every `*_diagnosed` metric for one policy. */
export function diagnosedTotals(comparison: Comparison | undefined, policy: string) {
  if (!comparison) return null;
  let hit = 0;
  let total = 0;
  let found = false;
  for (const metric of comparison.metrics) {
    if (!metric.key.endsWith('_diagnosed')) continue;
    const value = metric.values[policy];
    if (typeof value !== 'string') continue;
    const [correct, weeks] = value.split('/').map(Number);
    if (Number.isFinite(correct) && Number.isFinite(weeks)) {
      hit += correct;
      total += weeks;
      found = true;
    }
  }
  return found ? { hit, total } : null;
}

/** A metric value as a number to rank by ("3/4" → 0.75). */
function metricNumber(value: MetricValue | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const fraction = value.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fraction) return Number(fraction[2]) > 0 ? Number(fraction[1]) / Number(fraction[2]) : null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** The policies with the best value of a metric; empty when there is no single best. */
export function bestPolicies(metric: ComparisonMetric, policies: string[]): Set<string> {
  const scored = policies
    .map((policy) => [policy, metricNumber(metric.values[policy])] as const)
    .filter((entry): entry is readonly [string, number] => entry[1] !== null);
  if (scored.length < 2 || metric.better === 'none') return new Set();
  const target =
    metric.better === 'lower'
      ? Math.min(...scored.map(([, value]) => value))
      : metric.better === 'higher'
        ? Math.max(...scored.map(([, value]) => value))
        : 0;
  const best = scored.filter(([, value]) => Math.abs(value - target) < 1e-9).map(([policy]) => policy);
  return best.length === scored.length ? new Set() : new Set(best);
}

export function formatMetric(key: string, value: MetricValue | undefined) {
  if (value == null) return '-';
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return '-';
  if (key === 'wape') return value.toFixed(3);
  if (key === 'mae') return value.toFixed(1);
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
