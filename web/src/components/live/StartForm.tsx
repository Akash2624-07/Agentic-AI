import { useState } from 'react';
import type { Meta } from '../../api/types';
import { formatWeekStart } from '../../lib/format';
import { policyColor, policyLabel } from '../../lib/policies';
import { Badge } from '../Badge';
import { ChartCard } from '../ChartCard';
import { Icon, Spinner } from '../Icon';
import { Skeleton } from '../Skeleton';

interface StartFormProps {
  meta: Meta | undefined;
  busy: boolean;
  elapsed: number;
  onStart: (policy: string, startWeek: number) => void;
}

export function StartForm({ meta, busy, elapsed, onStart }: StartFormProps) {
  const [policy, setPolicy] = useState('rules');
  const [startWeek, setStartWeek] = useState(28);
  const nWeeks = meta?.n_weeks ?? 92;
  const week0 = meta?.week0 ?? '2011-04-01';
  const faults = meta?.faults ?? [];
  const nextFault = faults.find((fault) => fault.start >= startWeek);
  const presets = [
    { w: 0, label: 'from the start' },
    ...faults.map((fault) => ({
      w: Math.max(0, fault.start - 2),
      label: `2 weeks before ${fault.feature} fault`,
    })),
  ];

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <ChartCard title="1 · Pick a policy">
        <div className="stack" style={{ padding: '12px 20px 20px', gap: 8 }} role="radiogroup" aria-label="Policy">
          {(meta?.policies ?? []).map((p) => (
            <label
              key={p.name}
              className="card"
              style={{
                display: 'flex',
                gap: 12,
                padding: '12px 14px',
                cursor: 'pointer',
                boxShadow: 'none',
                borderColor: policy === p.name ? 'var(--ink)' : undefined,
                background: policy === p.name ? 'var(--surface-2)' : undefined,
              }}
            >
              <input
                type="radio"
                name="policy"
                value={p.name}
                checked={policy === p.name}
                onChange={() => setPolicy(p.name)}
                disabled={busy}
                style={{ marginTop: 4 }}
              />
              <div className="stack" style={{ gap: 3 }}>
                <span className="row" style={{ gap: 8 }}>
                  <span
                    className={`key-line${p.name === 'never' ? ' dash' : ''}`}
                    style={{ color: policyColor(p.name) }}
                  />
                  <strong>{p.label}</strong>
                  <code className="tiny">{p.name}</code>
                </span>
                <span className="small ink2">{p.description}</span>
                {p.uses_llm && meta && (
                  <span className="small row" style={{ gap: 6 }}>
                    {meta.llm.configured ? (
                      <Badge tone="good">
                        <Icon name="check" size={12} /> LLM: {meta.llm.model ?? '?'} ({meta.llm.provider ?? '?'})
                      </Badge>
                    ) : (
                      <Badge tone="warn">
                        <Icon name="alert" size={12} /> No LLM configured: falls back to the rules
                      </Badge>
                    )}
                    {meta.llm.configured && <span className="muted">each non-quiet week takes ~3–10 s</span>}
                  </span>
                )}
              </div>
            </label>
          ))}
          {!meta && [0, 1, 2, 3].map((i) => <Skeleton key={i} h={64} />)}
        </div>
      </ChartCard>
      <ChartCard title="2 · Pick a start week">
        <div className="stack" style={{ padding: '12px 20px 20px' }}>
          <div className="row" style={{ gap: 14 }}>
            <input
              type="range"
              min={0}
              max={nWeeks - 2}
              value={startWeek}
              onChange={(event) => setStartWeek(Number(event.target.value))}
              disabled={busy}
              style={{ flex: 1, minWidth: 160, accentColor: 'var(--accent)' }}
              aria-label="Start week"
            />
            <input
              type="number"
              className="input num"
              min={0}
              max={nWeeks - 2}
              value={startWeek}
              onChange={(event) => setStartWeek(Math.max(0, Math.min(nWeeks - 2, Number(event.target.value) || 0)))}
              disabled={busy}
              style={{ width: 80 }}
              aria-label="Start week number"
            />
          </div>
          <div className="row" style={{ gap: 6 }}>
            {presets.map((preset) => (
              <button
                key={preset.w}
                type="button"
                className="chip"
                aria-pressed={startWeek === preset.w}
                onClick={() => setStartWeek(preset.w)}
                disabled={busy}
              >
                {preset.w} · {preset.label}
              </button>
            ))}
          </div>
          <p className="small ink2">
            Week {startWeek} starts on <b>{formatWeekStart(week0, startWeek)}</b>
            {'.'}
            {' '}
            {nextFault
              ? nextFault.start === startWeek
                ? `The ${nextFault.feature} fault starts this very week.`
                : `The next injected fault (${nextFault.feature}, week ${nextFault.start}) is ${nextFault.start - startWeek} week${nextFault.start - startWeek > 1 ? 's' : ''} away.`
              : 'No more injected faults after this week.'}
            {' '}
            Weeks before it are replayed silently, with every proposal that passes the gate auto-approved.
          </p>
          <div className="divider" />
          <button className="btn primary big" onClick={() => onStart(policy, startWeek)} disabled={busy || !meta}>
            {busy ? <Spinner /> : <Icon name="play" />}
            {busy ? 'Starting…' : `Start a ${policyLabel(policy)} session at week ${startWeek}`}
          </button>
          {busy && (
            <div className="stack fade-in" style={{ gap: 6 }} aria-live="polite">
              <div className="progress">
                <i />
              </div>
              <span className="small ink2">
                Training champion v1 on Jan–Mar 2011, then replaying weeks 0–{Math.max(0, startWeek - 1)}
                {'… '}
                <span className="num">{elapsed}s</span>
                {elapsed > 8 && <span className="muted"> (this usually takes 10–60 s)</span>}
              </span>
            </div>
          )}
        </div>
      </ChartCard>
    </div>
  );
}
