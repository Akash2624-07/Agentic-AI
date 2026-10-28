import { useEffect, useMemo, useRef, useState } from 'react';
import type { LiveSession, Meta } from '../../api/types';
import { formatVersion, humanize } from '../../lib/format';
import { policyColor, policyLabel } from '../../lib/policies';
import { href } from '../../lib/router';
import { toast } from '../../lib/toast';
import { Badge } from '../Badge';
import { ChartCard } from '../ChartCard';
import { DecisionLog } from '../DecisionLog';
import { WeekDrawer } from '../drawer/WeekDrawer';
import { Icon, Spinner } from '../Icon';
import { ErrorChart } from '../signals/ErrorChart';
import type { ChartContext } from '../signals/shared';
import { ApprovalPanel } from './ApprovalPanel';
import { CurrentWeek } from './CurrentWeek';
import type { Busy, RunAction } from './types';

interface SessionViewProps {
  s: LiveSession;
  meta: Meta | undefined;
  busy: Busy;
  elapsed: number;
  run: RunAction;
}

function eventTone(event: string) {
  if (event === 'promote') return 'good';
  if (event === 'rollback') return 'serious';
  if (event === 'awaiting_approval') return 'warn';
  if (event.includes('reject')) return 'bad';
  return 'neutral';
}

/** The running session: controls, the pending proposal, this week, error so far, registry and decisions. */
export function SessionView({ s: session, meta, busy, elapsed, run }: SessionViewProps) {
  const week0 = meta?.week0 ?? '2011-04-01';
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  const blocked = !!session.pending || session.finished || busy !== null;
  const nextWeek = (session.week ?? -1) + 1;
  const usesLlm = session.policy === 'agent';

  const step = () =>
    run('step', { kind: 'step' }, (state) => {
      if (state.current) {
        toast('info', `Week ${state.current.week}: ${humanize(state.current.action)}`, state.current.reason ?? undefined, 3000);
      }
    });

  const runToDecision = () =>
    run('run', { kind: 'run' }, (state) => {
      const weeks = (state.week ?? 0) - (session.week ?? 0);
      if (state.current) {
        toast(
          'info',
          `Ran ${weeks} week${weeks === 1 ? '' : 's'} to week ${state.current.week}`,
          `${humanize(state.current.cause)} → ${humanize(state.current.action)}`,
          3500,
        );
      }
    });

  // The keyboard handler is registered once and reads the latest actions from here.
  const shortcuts = useRef({ step, toDecision: runToDecision, blocked });
  shortcuts.current = { step, toDecision: runToDecision, blocked };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        document.querySelector('.drawer') ||
        shortcuts.current.blocked
      ) {
        return;
      }
      if (event.key === 'n' || event.key === 'N') shortcuts.current.step();
      if (event.key === 'r' || event.key === 'R') shortcuts.current.toDecision();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const ctx = useMemo<ChartContext>(
    () => ({
      week0,
      faults: meta?.faults ?? [],
      nWeeks: session.n_weeks,
      selectedWeek: session.week,
      onWeekClick: (week) => setOpenWeek(week),
      shadeUntil: session.week ?? -1,
    }),
    [week0, meta?.faults, session.n_weeks, session.week],
  );

  return (
    <>
      <div className="card card-pad stack" style={{ gap: 14, position: 'sticky', top: 64, zIndex: 20 }}>
        <div className="row" style={{ gap: 18 }}>
          <span className="row" style={{ gap: 8 }}>
            <span
              className={`key-line${session.policy === 'never' ? ' dash' : ''}`}
              style={{ color: policyColor(session.policy) }}
            />
            <strong>{policyLabel(session.policy)}</strong>
          </span>
          <span className="small ink2">
            {'week '}
            <b className="num" style={{ color: 'var(--ink)' }}>
              {session.week ?? '-'}
            </b>
            {' of '}
            {session.n_weeks - 1}
          </span>
          <span className="small ink2">
            live model <b style={{ color: 'var(--ink)' }}>{formatVersion(session.live_version)}</b>
          </span>
          <a
            className="small mono"
            href={href('explore', { run: session.run_id })}
            title="Open this session in the run explorer"
          >
            {session.run_id}
          </a>
          <span className="spacer" />
          <button className="btn sm" onClick={() => run('stop', { kind: 'stop' }, () => undefined)} disabled={busy !== null}>
            <Icon name="stop" size={12} /> End session
          </button>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn primary big" onClick={step} disabled={blocked} title="Shortcut: N">
            {busy === 'step' ? <Spinner /> : <Icon name="play" />} Next week
            {!session.finished && ` (${nextWeek})`}
          </button>
          <button
            className="btn big"
            onClick={runToDecision}
            disabled={blocked}
            title="Shortcut: R. Steps until the policy does more than watch, a proposal waits, or 30 weeks pass."
          >
            {busy === 'run' ? <Spinner /> : <Icon name="skip" />} Run to next decision
          </button>
          <div className="small ink2" style={{ flex: '1 1 220px' }} aria-live="polite">
            {busy === 'step' || busy === 'run' ? (
              <span className="row" style={{ gap: 8 }}>
                <span className="num">
                  {busy === 'step' ? `Running week ${nextWeek}…` : 'Running until the policy acts…'} {elapsed}s
                </span>
                {usesLlm && <span className="muted">LLM weeks take ~3–10 s each</span>}
              </span>
            ) : session.pending ? (
              <b style={{ color: 'var(--t-warn-fg)' }}>
                Stepping is paused until you approve or reject the proposal below.
              </b>
            ) : session.finished ? (
              <span>The stream is over. End the session to start another.</span>
            ) : (
              <span className="muted">Shortcuts: N next week · R run to next decision</span>
            )}
          </div>
        </div>
        {(busy === 'step' || busy === 'run') && (
          <div className="progress">
            <i />
          </div>
        )}
      </div>
      {session.pending && <ApprovalPanel s={session} busy={busy} run={run} />}
      <CurrentWeek s={session} week0={week0} onOpen={setOpenWeek} />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <ChartCard
          title="Error so far"
          sub="Live model's WAPE ÷ its baseline, on each labelled week"
          explain={{
            seeing: <>One dot per week whose true counts have arrived (a week late).</>,
            read: <>Two clean weeks above the dashed line raise the error alert. Hollow dots: faulty inputs, ignored.</>,
            notice: (
              <>
                Watch the dots stay calm while a fault is active: the error can't see the bug. The quality check can.
              </>
            ),
          }}
        >
          <ErrorChart
            error={session.error}
            c={ctx}
            meta={meta}
            height={220}
            compact
            xDomain={[-0.5, Math.min(session.n_weeks - 1, Math.max((session.week ?? 0) + 3, 15)) + 0.5]}
          />
        </ChartCard>
        <ChartCard title="Model registry" sub="This session's model changes">
          <div className="table-wrap" style={{ maxHeight: 330, marginTop: 10, borderTop: '1px solid var(--border)' }}>
            <table className="t">
              <thead>
                <tr>
                  <th className="r">Week</th>
                  <th>Event</th>
                  <th>Model</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {[...session.events]
                  .filter((e) => e.event !== 'register')
                  .reverse()
                  .map((e, i) => (
                    <tr key={`${e.week}-${e.event}-${e.version}-${i}`}>
                      <td className="r num">{e.week < 0 ? 'init' : e.week}</td>
                      <td>
                        <Badge tone={eventTone(e.event)}>{humanize(e.event)}</Badge>
                      </td>
                      <td>{formatVersion(e.version)}</td>
                      <td className="small ink2">{e.detail}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
      <ChartCard title="This session's decisions" sub="Newest first. Click a row for the week's evidence.">
        <DecisionLog rows={session.rows} newestFirst onPick={setOpenWeek} selectedWeek={openWeek} maxHeight={380} />
      </ChartCard>
      {openWeek !== null && (
        <WeekDrawer
          runId={session.run_id}
          week={openWeek}
          week0={week0}
          nWeeks={(session.week ?? 0) + 1}
          onClose={() => setOpenWeek(null)}
          onWeek={(week) => setOpenWeek(Math.max(0, Math.min(session.week ?? 0, week)))}
        />
      )}
    </>
  );
}
