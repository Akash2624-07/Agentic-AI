import type { Comparison } from '../../api/types';
import { diagnosedTotals, metricValue } from '../../lib/metrics';
import { href } from '../../lib/router';
import { Icon } from '../Icon';
import { Skeleton } from '../Skeleton';
import { ResultCard, type ResultBar } from './ResultCard';

/** The four headline results of the evaluation, as bars per policy. */
export function Results({ c: comparison }: { c: Comparison | undefined }) {
  if (!comparison) {
    return (
      <div className="grid-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} h={210} r={10} />
        ))}
      </div>
    );
  }

  const policies = comparison.policies;
  const value = (key: string, policy: string) => {
    const v = metricValue(comparison, key, policy);
    return typeof v === 'number' ? v : null;
  };
  const bars = (key: string, text: (value: number) => string): ResultBar[] =>
    policies.flatMap((policy) => {
      const v = value(key, policy);
      return v === null ? [] : [{ policy, value: v, text: text(v) }];
    });
  const diagnosedBars = policies.flatMap((policy) => {
    const totals = diagnosedTotals(comparison, policy);
    return totals
      ? [{ policy, value: totals.total ? totals.hit / totals.total : 0, text: `${totals.hit}/${totals.total}` }]
      : [];
  });

  const neverMae = value('mae', 'never');
  const rulesMae = value('mae', 'rules');
  const naiveFaultyRetrains = value('retrains_on_faulty_data', 'on_alert');
  const rulesFaultyRetrains = value('retrains_on_faulty_data', 'rules');
  const naivePromotionsInFault = value('promotions_during_fault', 'on_alert');
  const rulesDiagnosed = diagnosedTotals(comparison, 'rules');
  const rulesFalseAlarms = value('false_fault_alarms', 'rules');

  return (
    <>
      <div className="grid-4">
        <ResultCard
          label="Average error (MAE, bikes / hour)"
          bars={bars('mae', (v) => v.toFixed(1))}
          note={
            neverMae && rulesMae
              ? `A frozen model ends up ${(neverMae / rulesMae).toFixed(1)}× worse than the rules: demand moves, so the model must keep learning.`
              : undefined
          }
        />
        <ResultCard
          label="Retrains on faulty data"
          bars={bars('retrains_on_faulty_data', (v) => String(v))}
          note={
            naiveFaultyRetrains !== null && rulesFaultyRetrains !== null
              ? `Naive retraining learned from broken weeks ${naiveFaultyRetrains} times; the rules ${rulesFaultyRetrains === 0 ? 'never did' : `${rulesFaultyRetrains} times`}.`
              : undefined
          }
        />
        <ResultCard
          label="Fault weeks diagnosed as a pipeline fault"
          bars={diagnosedBars}
          note={
            rulesDiagnosed
              ? `The rules named the cause in ${rulesDiagnosed.hit} of ${rulesDiagnosed.total} fault weeks${rulesFalseAlarms === 0 ? ', with no false alarms on clean weeks' : ''}.`
              : undefined
          }
          higherIsBetter
        />
        <ResultCard
          label="Promotions while a fault was active"
          bars={bars('promotions_during_fault', (v) => String(v))}
          note={
            naivePromotionsInFault === null
              ? undefined
              : `${naivePromotionsInFault} new models went live mid-incident under naive retraining; the safety gate blocks that.`
          }
        />
      </div>
      <div className="row">
        <a className="btn" href={href('compare')}>
          Full comparison and weekly error <Icon name="arrow" />
        </a>
        {!policies.includes('agent') && (
          <span className="small muted">The LLM agent's evaluation run isn't in the database yet.</span>
        )}
      </div>
    </>
  );
}
