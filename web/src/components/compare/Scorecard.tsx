import type { Comparison } from '../../api/types';
import { bestPolicies, formatMetric } from '../../lib/metrics';
import { policyColor, policyLabel } from '../../lib/policies';
import { ChartCard } from '../ChartCard';
import { Icon } from '../Icon';
import { Skeleton } from '../Skeleton';

/** Every evaluation metric, one column per policy, best value per row marked. */
export function Scorecard({ c: comparison, pols: policies }: { c: Comparison | undefined; pols: string[] }) {
  return (
    <ChartCard
      title="The scorecard"
      sub="Highlighted: the best value in a row, where one is better. Hover a metric for its definition."
    >
      <div className="table-wrap" style={{ marginTop: 12 }}>
        {comparison ? (
          <table className="t">
            <thead>
              <tr>
                <th>Metric</th>
                {policies.map((policy) => (
                  <th key={policy} className="r">
                    <span className="row" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                      <span
                        className={`key-line${policy === 'never' ? ' dash' : ''}`}
                        style={{ color: policyColor(policy) }}
                      />
                      {policyLabel(policy)}
                    </span>
                  </th>
                ))}
                <th style={{ minWidth: 260 }}>What it means</th>
              </tr>
            </thead>
            <tbody>
              {comparison.metrics.map((metric) => {
                const best = bestPolicies(metric, policies);
                return (
                  <tr key={metric.key}>
                    <td style={{ fontWeight: 600 }} title={metric.help}>
                      {metric.label}
                      {metric.better === 'zero' && (
                        <span className="tiny muted" style={{ display: 'block', fontWeight: 500 }}>
                          target 0
                        </span>
                      )}
                    </td>
                    {policies.map((policy) => (
                      <td key={policy} className="r num">
                        {best.has(policy) ? (
                          <span className="best-mark" title="Best in this row">
                            <Icon name="check" size={12} />
                            {formatMetric(metric.key, metric.values[policy])}
                          </span>
                        ) : (
                          formatMetric(metric.key, metric.values[policy])
                        )}
                      </td>
                    ))}
                    <td className="small ink2">{metric.help}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: 20 }} className="stack">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} h={20} />
            ))}
          </div>
        )}
      </div>
    </ChartCard>
  );
}
