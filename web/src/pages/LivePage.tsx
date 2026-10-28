import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { useLive, useLiveAction, useMeta } from '../api/queries';
import { ErrorBox } from '../components/ErrorBox';
import { SessionView } from '../components/live/SessionView';
import { StartForm } from '../components/live/StartForm';
import type { Busy, RunAction } from '../components/live/types';
import { PageHead } from '../components/PageHead';
import { Skeleton } from '../components/Skeleton';
import { formatVersion } from '../lib/format';
import { policyLabel } from '../lib/policies';
import { toast } from '../lib/toast';

/** Whole seconds since `running` last became true. */
function useElapsed(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    setSeconds(0);
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [running]);
  return seconds;
}

function describeError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409) return { title: 'Answer the proposal first', body: error.message };
    if (error.status === 404) return { title: 'No live session', body: error.message };
    if (error.status >= 500) return { title: 'The server hit an error', body: error.message };
    return { title: 'Request refused', body: error.message };
  }
  return { title: 'Something went wrong', body: error instanceof Error ? error.message : String(error) };
}

export default function LivePage() {
  const meta = useMeta();
  const live = useLive();
  const action = useLiveAction();
  const [busy, setBusy] = useState<Busy>(null);
  const elapsed = useElapsed(busy !== null);

  const run: RunAction = (key, liveAction, onDone) => {
    setBusy(key);
    action.mutate(liveAction, {
      onSuccess: (state) => {
        if (state.active) onDone?.(state);
      },
      onError: (error) => {
        const { title, body } = describeError(error);
        toast('error', title, body);
      },
      onSettled: () => setBusy(null),
    });
  };

  const state = live.data;

  return (
    <div className="stack-lg">
      <PageHead eyebrow="Live demo" title="You are the human in the loop">
        Step through the stream one week at a time. The policy decides; when a proposal passes the safety gate's
        rules, it waits for <b>your</b>
        {' '}
        approval. The session is logged and appears in the run explorer.
      </PageHead>
      {live.isError && <ErrorBox error={live.error} what="the live session" />}
      {live.isLoading && <Skeleton h={320} r={10} />}
      {state && !state.active && (
        <StartForm
          meta={meta.data}
          busy={busy === 'start'}
          elapsed={elapsed}
          onStart={(policy, startWeek) =>
            run('start', { kind: 'start', policy, start_week: startWeek }, (session) =>
              toast(
                'ok',
                `Session started: ${policyLabel(session.policy)}`,
                `Fast-forwarded to week ${session.week}. Live model ${formatVersion(session.live_version)}.`,
              ),
            )
          }
        />
      )}
      {state && state.active && <SessionView s={state} meta={meta.data} busy={busy} elapsed={elapsed} run={run} />}
    </div>
  );
}
