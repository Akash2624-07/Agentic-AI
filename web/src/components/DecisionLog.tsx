import { useMemo, useState } from 'react';
import type { DecisionRow } from '../api/types';
import { formatDate, formatNumber, formatVersion, humanize } from '../lib/format';
import { ACTION_TONE, CAUSE_TONE } from '../lib/labels';
import { ActionBadge, CauseBadge, FaultBadge } from './Badge';

const ACTION_ORDER = ['alert', 'retrain', 'rollback', 'escalate', 'watch', 'none'];
const CAUSE_ORDER = ['pipeline_fault', 'genuine_drift', 'bad_update', 'unclear', 'noise', 'none', 'unknown'];

/** Sorts by position in `order`; unknown values go last. */
function sortByOrder(values: string[], order: string[]) {
  const rank = (value: string) => order.indexOf(value) + 100 * Number(order.indexOf(value) < 0);
  return [...values].sort((a, b) => rank(a) - rank(b));
}

function toggled(set: Set<string>, value: string) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

interface DecisionLogProps {
  rows: DecisionRow[];
  selectedWeek: number | null;
  onPick: (week: number) => void;
  newestFirst?: boolean;
  maxHeight?: number;
  showFilters?: boolean;
}

export function DecisionLog({
  rows,
  selectedWeek,
  onPick,
  newestFirst,
  maxHeight = 460,
  showFilters = true,
}: DecisionLogProps) {
  const [actions, setActions] = useState<Set<string>>(new Set());
  const [causes, setCauses] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const byAction = new Map<string, number>();
    const byCause = new Map<string, number>();
    for (const row of rows) {
      if (row.action) byAction.set(row.action, (byAction.get(row.action) ?? 0) + 1);
      if (row.cause) byCause.set(row.cause, (byCause.get(row.cause) ?? 0) + 1);
    }
    return { actions: byAction, causes: byCause };
  }, [rows]);

  const shown = useMemo(() => {
    const filtered = rows.filter(
      (row) => (!actions.size || actions.has(row.action ?? '')) && (!causes.size || causes.has(row.cause ?? '')),
    );
    return newestFirst ? [...filtered].reverse() : filtered;
  }, [rows, actions, causes, newestFirst]);

  const hasConfidence = rows.some((row) => row.confidence !== null && row.confidence !== undefined);

  return (
    <div>
      {showFilters && (
        <div className="stack" style={{ gap: 8, padding: '12px 20px' }}>
          <div className="row" style={{ gap: 6 }}>
            <span className="small muted" style={{ width: 52 }}>
              Action
            </span>
            {sortByOrder([...counts.actions.keys()], ACTION_ORDER).map((action) => (
              <button
                key={action}
                type="button"
                className="chip"
                aria-pressed={actions.has(action)}
                onClick={() => setActions(toggled(actions, action))}
              >
                <span
                  className={`key-dot tone-${ACTION_TONE[action] ?? 'neutral'}`}
                  style={{ border: '1px solid var(--border-strong)' }}
                />
                {humanize(action)}{' '}
                <span className="muted num">{counts.actions.get(action)}</span>
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 6 }}>
            <span className="small muted" style={{ width: 52 }}>
              Cause
            </span>
            {sortByOrder([...counts.causes.keys()], CAUSE_ORDER).map((cause) => (
              <button
                key={cause}
                type="button"
                className="chip"
                aria-pressed={causes.has(cause)}
                onClick={() => setCauses(toggled(causes, cause))}
              >
                <span
                  className={`key-dot tone-${CAUSE_TONE[cause] ?? 'neutral'}`}
                  style={{ border: '1px solid var(--border-strong)' }}
                />
                {humanize(cause)}{' '}
                <span className="muted num">{counts.causes.get(cause)}</span>
              </button>
            ))}
            {(actions.size > 0 || causes.size > 0) && (
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => {
                  setActions(new Set());
                  setCauses(new Set());
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}
      <div
        className="table-wrap"
        style={{ maxHeight, borderTop: '1px solid var(--border)', borderRadius: '0 0 10px 10px' }}
      >
        <table className="t">
          <thead>
            <tr>
              <th className="r">Week</th>
              <th>Start</th>
              <th>Live</th>
              <th>Alerts</th>
              <th>Cause</th>
              <th>Action</th>
              <th style={{ minWidth: 260 }}>Reason</th>
              {hasConfidence && <th className="r">Conf.</th>}
              <th className="r">MAE</th>
              <th>Injected fault</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr
                key={row.week}
                className={`clickable${row.week === selectedWeek ? ' selected' : ''}${row.fault.length ? ' fault-row' : ''}`}
                onClick={() => onPick(row.week)}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onPick(row.week);
                  }
                }}
                aria-label={`Week ${row.week}: ${row.cause ?? '-'}, ${row.action ?? '-'}. Open details.`}
              >
                <td className="r num" style={{ fontWeight: 650 }}>
                  {row.week}
                </td>
                <td className="nowrap ink2">{formatDate(row.start)}</td>
                <td className="nowrap">{formatVersion(row.live_version)}</td>
                <td className="small ink2">
                  {row.alerts.length ? row.alerts.join(', ') : <span className="muted">-</span>}
                </td>
                <td>
                  <CauseBadge cause={row.cause} />
                </td>
                <td>
                  <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                    <ActionBadge action={row.action} />
                    {row.promoted && <span title="promoted">▲</span>}
                    {row.rolled_back && <span title="rolled back">✕</span>}
                  </span>
                </td>
                <td className="small">{row.reason}</td>
                {hasConfidence && (
                  <td className="r num">{row.confidence === null ? '' : row.confidence.toFixed(2)}</td>
                )}
                <td className="r num">{formatNumber(row.mae)}</td>
                <td>
                  <FaultBadge kinds={row.fault} />
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={10} className="empty">
                  No weeks match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
