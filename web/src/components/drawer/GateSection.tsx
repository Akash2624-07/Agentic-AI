import type { DecisionRow, GateDetail } from '../../api/types';
import { formatNumber, formatPercent, formatValue, formatVersion } from '../../lib/format';
import { CheckChip } from '../CheckChip';
import { Icon } from '../Icon';

function outcome(gate: GateDetail, row: DecisionRow) {
  if (row.promoted) return 'promoted';
  if (row.rolled_back) return 'rolled back';
  if (gate.human) return 'rejected by the human';
  if (gate.pending) return 'waiting for a human';
  return 'not promoted';
}

export function GateSection({ gate, row }: { gate: GateDetail | null; row: DecisionRow }) {
  return (
    <section>
      <div className="section-title">Safety gate</div>
      {gate ? (
        <div className="stack" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 6 }}>
            {Object.entries(gate.checks).map(([name, passed]) => (
              <CheckChip key={name} name={name} passed={passed} />
            ))}
            {!('human_approved' in gate.checks) && (gate.human || gate.pending) && (
              <CheckChip name="human_approved" passed={gate.human ? gate.human.approved : null} />
            )}
          </div>
          <p className="small">{gate.reason}</p>
          {gate.challenger_mae !== undefined && gate.champion_mae !== undefined && (
            <dl className="kv">
              <dt>Holdout week</dt>
              <dd className="num">{gate.holdout_week}</dd>
              <dt>Live model {formatVersion(gate.champion)} MAE</dt>
              <dd className="num">{formatNumber(gate.champion_mae)}</dd>
              <dt>Challenger {formatVersion(gate.challenger)} MAE</dt>
              <dd className="num">
                {formatNumber(gate.challenger_mae)}{' '}
                <span className="muted">
                  ({formatPercent(1 - gate.challenger_mae / gate.champion_mae, 1)} better; needs ≥ 5%)
                </span>
              </dd>
            </dl>
          )}
          {gate.previous_wape !== undefined && gate.champion_wape !== undefined && (
            <dl className="kv">
              <dt>Shadow weeks</dt>
              <dd className="num">{(gate.weeks ?? []).join(', ')}</dd>
              <dt>Live {formatVersion(gate.champion)} WAPE</dt>
              <dd className="num">{formatValue(gate.champion_wape)}</dd>
              <dt>Previous {formatVersion(gate.previous)} WAPE</dt>
              <dd className="num">{formatValue(gate.previous_wape)}</dd>
            </dl>
          )}
          {gate.human && (
            <p className="small">
              <Icon name="user" size={14} /> Human {gate.human.approved ? 'approved' : 'rejected'}
              {gate.human.note ? `: “${gate.human.note}”` : ''}
            </p>
          )}
          <p className="small">
            Outcome: <b>{outcome(gate, row)}</b>
          </p>
        </div>
      ) : (
        <p className="small muted">{row.gate ? row.gate : 'Nothing went through the gate this week.'}</p>
      )}
    </section>
  );
}
