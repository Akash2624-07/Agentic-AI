import type { ReactNode } from 'react';
import type { Comparison } from '../../api/types';
import { diagnosedTotals, metricValue } from '../../lib/metrics';
import { href } from '../../lib/router';

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/** "What to notice", written from the numbers of whichever policies were evaluated. */
export function CompareNotes({ c: comparison }: { c: Comparison }) {
  const value = (key: string, policy: string) => {
    const v = metricValue(comparison, key, policy);
    return typeof v === 'number' ? v : null;
  };
  const evaluated = (policy: string) => comparison.policies.includes(policy);
  const notes: ReactNode[] = [];

  if (evaluated('on_alert')) {
    const mae = value('mae', 'on_alert');
    const faultyRetrains = value('retrains_on_faulty_data', 'on_alert');
    const promotionsInFault = value('promotions_during_fault', 'on_alert');
    notes.push(
      <>
        <b>Naive retraining wins on raw error</b> (MAE {mae?.toFixed(1)}) but trained {faultyRetrains} models on faulty
        data and promoted {promotionsInFault} during a fault. Nothing checked the data or the new model.
      </>,
    );
  }

  if (evaluated('rules')) {
    const diagnosed = diagnosedTotals(comparison, 'rules');
    const rulesMae = value('mae', 'rules');
    const naiveMae = value('mae', 'on_alert');
    notes.push(
      <>
        <b>The rules are safe at a small price:</b> {value('retrains_on_faulty_data', 'rules')} retrains on faulty
        data, both faults diagnosed
        {diagnosed ? ` ${diagnosed.hit}/${diagnosed.total}` : ''}, {value('false_fault_alarms', 'rules')} false alarms
        {rulesMae && naiveMae ? `, for ${Math.round((rulesMae / naiveMae - 1) * 100)}% more error than naive retraining` : ''}
        .
      </>,
    );
  }

  if (evaluated('never')) {
    notes.push(
      <>
        <b>Doing nothing is the worst option:</b> the frozen model's MAE is {value('mae', 'never')?.toFixed(1)}. The
        world changes, so the model has to.
      </>,
    );
  }

  if (evaluated('agent')) {
    const diagnosed = diagnosedTotals(comparison, 'agent');
    const fallbackWeeks = value('llm_fallback_weeks', 'agent');
    notes.push(
      <>
        <b>The LLM agent</b> runs the same table with tools: MAE {value('mae', 'agent')?.toFixed(1)}
        {', '}
        {value('retrains_on_faulty_data', 'agent')} retrains on faulty data
        {diagnosed ? `, faults diagnosed ${diagnosed.hit}/${diagnosed.total}` : ''}
        {', '}
        {plural(value('escalations', 'agent') ?? 0, 'escalation')} to a human
        {fallbackWeeks ? `. ${fallbackWeeks} weeks fell back to the rules because the LLM call failed` : ''}.
      </>,
    );
  }

  return (
    <div className="callout">
      <h3>What to notice</h3>
      <ul className="small">
        {notes.map((note, i) => (
          <li key={i}>{note}</li>
        ))}
        <li>
          <b>Same symptom, opposite fix.</b> Seasonal drift is fixed by retraining; a pipeline fault by fixing the
          pipeline, never by retraining on it.{' '}
          <a href={href('explore', { run: 'eval:rules', week: 30 })}>See week 30 in the rules run</a>.
        </li>
      </ul>
    </div>
  );
}
