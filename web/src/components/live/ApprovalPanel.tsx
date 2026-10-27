import { useEffect, useRef, useState } from 'react';
import type { LiveSession } from '../../api/types';
import { formatVersion } from '../../lib/format';
import { toast } from '../../lib/toast';
import { CheckChip } from '../CheckChip';
import { Icon, Spinner } from '../Icon';
import type { Busy, RunAction } from './types';

/** The proposal waiting for the human: why, its numbers, the gate's checks, and approve / reject. */
export function ApprovalPanel({ s: session, busy, run }: { s: LiveSession; busy: Busy; run: RunAction }) {
  const pending = session.pending!;
  const [note, setNote] = useState('');
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [session.week]);

  const stats = Object.entries(pending.headline).filter(([label]) => label !== 'proposal');
  const resolve = (approved: boolean) =>
    run('resolve', { kind: 'resolve', approved, note }, (state) =>
      toast(
        approved ? 'ok' : 'info',
        approved
          ? `Approved: ${String(pending.headline.proposal ?? pending.kind)}`
          : `Rejected: ${String(pending.headline.proposal ?? pending.kind)}`,
        `Live model is now ${formatVersion(state.live_version)}.`,
      ),
    );

  return (
    <section
      ref={panelRef}
      className="card fade-in"
      style={{ borderColor: 'var(--t-warn-fg)', borderWidth: 2, overflow: 'hidden' }}
      aria-labelledby="approval-title"
    >
      <div className="tone-warn" style={{ padding: '12px 20px', display: 'flex', gap: 10, alignItems: 'center' }}>
        <Icon name="user" />
        <strong id="approval-title" style={{ fontSize: 16 }}>
          {'Your approval is needed: '}
          {String(pending.headline.proposal ?? (pending.kind === 'promote' ? 'promote a challenger' : 'roll back'))}
        </strong>
      </div>
      <div className="card-pad stack">
        <p>
          <span className="muted">Why the policy proposed it: </span>
          {pending.reason}
        </p>
        <div className="grid-4">
          {stats.map(([label, value]) => (
            <div key={label} className="stat">
              <span className="stat-label">{label}</span>
              <span className="stat-value" style={{ fontSize: 24 }}>
                {String(value)}
              </span>
            </div>
          ))}
        </div>
        <div>
          <div className="section-title">Safety gate checks</div>
          <div className="row" style={{ gap: 6 }}>
            {pending.checks.map((check) => (
              <CheckChip key={check.check} name={check.check} passed={check.passed} />
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 6 }}>
            {pending.gate_reason}. Every rule passed, so the gate is asking you.
          </p>
        </div>
        <label className="field">
          Note for the audit log (optional)
          <input
            className="input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. checked the holdout week, looks fine"
            disabled={busy !== null}
            maxLength={500}
          />
        </label>
        <div className="row">
          <button className="btn good big" onClick={() => resolve(true)} disabled={busy !== null}>
            {busy === 'resolve' ? <Spinner /> : <Icon name="check" />} Approve
          </button>
          <button className="btn bad big" onClick={() => resolve(false)} disabled={busy !== null}>
            <Icon name="x" /> Reject
          </button>
          <span className="small muted">Stepping stays disabled until you answer.</span>
        </div>
      </div>
    </section>
  );
}
