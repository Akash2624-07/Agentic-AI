import { useEffect, useRef } from 'react';
import { useWeek } from '../../api/queries';
import { formatVersion, formatWeekStart } from '../../lib/format';
import { ACTION_HELP, CAUSE_HELP, PATH_LABELS } from '../../lib/labels';
import { ActionBadge, Badge, CauseBadge, FaultBadge } from '../Badge';
import { ErrorBox } from '../ErrorBox';
import { Icon } from '../Icon';
import { AgentSection } from './AgentSection';
import { DrawerSkeleton } from './DrawerSkeleton';
import { FeatureEvidenceTable } from './FeatureEvidenceTable';
import { GateSection } from './GateSection';
import { LabelledErrorSection } from './LabelledErrorSection';

interface WeekDrawerProps {
  runId: string;
  week: number;
  week0: string;
  nWeeks: number;
  onClose: () => void;
  onWeek: (week: number) => void;
}

/** Side panel with everything recorded for one week of a run. Esc closes, ←/→ change week. */
export function WeekDrawer({ runId, week, week0, nWeeks, onClose, onWeek }: WeekDrawerProps) {
  const detail = useWeek(runId, week);
  const panelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    panelRef.current?.focus();
    return () => (returnFocusRef.current as HTMLElement | null)?.focus?.();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        if (event.key === 'ArrowLeft' && week > 0) onWeek(week - 1);
        if (event.key === 'ArrowRight' && week < nWeeks - 1) onWeek(week + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [week, nWeeks, onClose, onWeek]);

  const data = detail.data;
  const row = data?.row;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        ref={panelRef}
        tabIndex={-1}
      >
        <div className="drawer-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="tiny muted mono"
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {runId}
            </div>
            <h2 id="drawer-title" style={{ fontSize: 20 }}>
              Week {week}{' '}
              <span className="muted" style={{ fontWeight: 500, fontSize: 15 }}>
                · {formatWeekStart(week0, week)}
              </span>
            </h2>
            <div className="row" style={{ gap: 6, marginTop: 6 }}>
              {row && <Badge tone="neutral">live model {formatVersion(row.live_version)}</Badge>}
              {row && <FaultBadge kinds={row.fault} />}
            </div>
          </div>
          <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
            <button
              className="icon-btn"
              onClick={() => onWeek(week - 1)}
              disabled={week <= 0}
              aria-label="Previous week"
              title="Previous week (←)"
            >
              <Icon name="chevron" size={14} className="flip" />
            </button>
            <button
              className="icon-btn"
              onClick={() => onWeek(week + 1)}
              disabled={week >= nWeeks - 1}
              aria-label="Next week"
              title="Next week (→)"
            >
              <Icon name="chevron" size={14} />
            </button>
            <button className="icon-btn" onClick={onClose} aria-label="Close" title="Close (Esc)">
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>
        <div className="drawer-body" aria-busy={detail.isFetching}>
          {detail.isError && <ErrorBox error={detail.error} what={`week ${week}`} />}
          {!data && !detail.isError && <DrawerSkeleton />}
          {data && row && (
            <>
              {row.fault.length > 0 && (
                <div className="callout warn small">
                  <b>Injected fault this week: {row.fault.join(', ')}.</b> Ground truth for the evaluation; the policy
                  never sees it.
                </div>
              )}
              <section>
                <div className="section-title">Decision</div>
                <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <div className="stack" style={{ gap: 4 }}>
                    <span className="tiny muted">cause</span>
                    <CauseBadge cause={row.cause} lg />
                  </div>
                  <div className="stack" style={{ gap: 4 }}>
                    <span className="tiny muted">action</span>
                    <ActionBadge action={row.action} lg />
                  </div>
                  {row.confidence !== null && row.confidence !== undefined && (
                    <div className="stack" style={{ gap: 4 }}>
                      <span className="tiny muted">confidence</span>
                      <strong className="num">{row.confidence.toFixed(2)}</strong>
                    </div>
                  )}
                  {row.path && (
                    <div className="stack" style={{ gap: 4 }}>
                      <span className="tiny muted">decided by</span>
                      <Badge tone={row.path === 'llm' ? 'info' : row.path === 'fallback' ? 'warn' : 'neutral'}>
                        {PATH_LABELS[row.path] ?? row.path}
                      </Badge>
                    </div>
                  )}
                </div>
                <p style={{ marginTop: 10 }}>{row.reason || <span className="muted">No reason recorded.</span>}</p>
                {row.cause && row.action && (
                  <p className="small muted" style={{ marginTop: 4 }}>
                    {CAUSE_HELP[row.cause] ?? ''}
                    {CAUSE_HELP[row.cause] && ACTION_HELP[row.action] ? ' → ' : ''}
                    {ACTION_HELP[row.action] ?? ''}
                  </p>
                )}
                <div className="row small" style={{ marginTop: 8, gap: 6 }}>
                  <span className="muted">alerts:</span>
                  {row.alerts.length ? (
                    row.alerts.map((alert) => (
                      <Badge key={alert} tone="neutral">
                        {alert}
                      </Badge>
                    ))
                  ) : (
                    <span className="muted">none</span>
                  )}
                </div>
              </section>
              {data.details && <AgentSection details={data.details} />}
              <GateSection gate={data.gate} row={row} />
              <LabelledErrorSection error={data.error} />
              <FeatureEvidenceTable features={data.features} />
            </>
          )}
        </div>
      </aside>
    </>
  );
}
