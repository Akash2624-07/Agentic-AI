import { useWeek } from '../../api/queries';
import type { FeatureEvidence, LiveSession } from '../../api/types';
import { featureLabel } from '../../lib/features';
import { formatVersion, formatWeekStart } from '../../lib/format';
import { PATH_LABELS } from '../../lib/labels';
import { ActionBadge, Badge, CauseBadge } from '../Badge';
import { Icon } from '../Icon';
import { Skeleton } from '../Skeleton';

function alertTone(alert: string) {
  if (alert === 'quality') return 'bad';
  if (alert === 'jump') return 'serious';
  if (alert === 'error') return 'warn';
  return 'info';
}

interface CurrentWeekProps {
  s: LiveSession;
  week0: string;
  onOpen: (week: number) => void;
}

/** The week just replayed: what the monitor saw, what the policy decided, and the hidden ground truth. */
export function CurrentWeek({ s: session, week0, onOpen }: CurrentWeekProps) {
  const current = session.current;
  const detail = useWeek(current ? session.run_id : null, current?.week ?? null);
  const lastLabel = session.error.length ? session.error[session.error.length - 1] : null;

  if (!current) {
    return <div className="card card-pad muted">No week has been replayed yet. Press “Next week”.</div>;
  }

  const flagged = (detail.data?.features ?? []).filter((feature) => feature.flags.length);
  const flaggedBy = (flag: FeatureEvidence['flags'][number]) =>
    flagged.filter((feature) => feature.flags.includes(flag)).map((feature) => featureLabel(feature.feature));

  return (
    // Keyed by week so each new week fades in.
    <section key={current.week} className="card" aria-labelledby="cur-title">
      <div className="card-head">
        <h3 id="cur-title" style={{ flex: 'none', minWidth: 0 }}>
          Week {current.week}{' '}
          <span className="muted" style={{ fontWeight: 500 }}>
            · {formatWeekStart(week0, current.week)}
          </span>
        </h3>
        <span className="small muted">live model {formatVersion(current.live_version)}</span>
      </div>
      <div className="grid-3 card-pad fade-in" style={{ gap: 20 }}>
        <div className="stack" style={{ gap: 8 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            What the monitor saw
          </div>
          <div className="row" style={{ gap: 6 }}>
            {current.alerts.length ? (
              current.alerts.map((alert) => (
                <Badge key={alert} tone={alertTone(alert)}>
                  {alert} alert
                </Badge>
              ))
            ) : (
              <Badge tone="good">no alerts</Badge>
            )}
          </div>
          {detail.data ? (
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              {flaggedBy('quality').length > 0 && (
                <li>
                  quality failed: <b>{flaggedBy('quality').join(', ')}</b>
                </li>
              )}
              {flaggedBy('jump').length > 0 && (
                <li>
                  sudden jump: <b>{flaggedBy('jump').join(', ')}</b>
                </li>
              )}
              {flaggedBy('drift').length > 0 && <li>drifted: {flaggedBy('drift').join(', ')}</li>}
              {flagged.length === 0 && <li className="muted">no feature flagged</li>}
            </ul>
          ) : (
            <Skeleton h={40} />
          )}
          {lastLabel && (
            <p className="small ink2">
              Labels for week {lastLabel.week}
              {' arrived: error '}
              <b className="num">{lastLabel.ratio?.toFixed(2) ?? '-'}×</b> baseline
              {!lastLabel.quality_ok && ' (faulty week, ignored)'}.
            </p>
          )}
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            What the policy decided
          </div>
          <div className="row" style={{ gap: 6 }}>
            <CauseBadge cause={current.cause} lg />
            <Icon name="arrow" />
            <ActionBadge action={current.action} lg />
          </div>
          <p className="small">{current.reason}</p>
          <div className="row small muted" style={{ gap: 12 }}>
            {current.confidence !== null && (
              <span>
                {'confidence '}
                <b className="num" style={{ color: 'var(--ink)' }}>
                  {current.confidence.toFixed(2)}
                </b>
              </span>
            )}
            {current.path && <span>decided by {PATH_LABELS[current.path] ?? current.path}</span>}
          </div>
          {current.gate && <p className="small ink2">Gate: {current.gate}</p>}
          <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => onOpen(current.week)}>
            Full evidence for week {current.week} <Icon name="arrow" size={14} />
          </button>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            Injected fault (hidden from the policy)
          </div>
          {session.current_fault.length ? (
            <div className="callout warn small" style={{ padding: '10px 12px' }}>
              <b>{session.current_fault.join(', ')}</b>
              <div style={{ marginTop: 4 }}>
                {session.current_fault.includes('temp_celsius') &&
                  'temp is arriving in °C (×41) instead of normalised. '}
                {session.current_fault.includes('hum_missing') && 'The humidity feed is empty. '}
                {current.cause === 'pipeline_fault'
                  ? 'The policy diagnosed it correctly.'
                  : 'The policy did not call this a pipeline fault.'}
              </div>
            </div>
          ) : (
            <p className="small ink2">
              <Badge tone="good">none</Badge> The data pipeline is healthy this week.
              {current.cause === 'pipeline_fault' && ' The policy called a pipeline fault anyway: a false alarm.'}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
