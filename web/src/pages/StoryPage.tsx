import { useComparison, useMeta } from '../api/queries';
import { ErrorBox } from '../components/ErrorBox';
import { Icon } from '../components/Icon';
import { Skeleton } from '../components/Skeleton';
import { Finding } from '../components/story/Finding';
import { LoopDiagram } from '../components/story/LoopDiagram';
import { ProblemCard } from '../components/story/ProblemCard';
import { Results } from '../components/story/Results';
import { policyColor } from '../lib/policies';
import { href } from '../lib/router';

export default function StoryPage() {
  const meta = useMeta();
  const comparison = useComparison();
  const llm = meta.data?.llm;

  return (
    <div className="stack-lg">
      <section className="stack" style={{ gap: 14 }}>
        <div className="eyebrow">B.Tech mini project · ABES CSE-DS · industry partner HCL</div>
        <h1 style={{ maxWidth: 900 }}>Feedback Loop Agent for ML Model Monitoring</h1>
        <p className="lede">
          A weekly loop around a deployed demand model. It watches the inputs and the error, works out <b>why</b> the
          model is struggling, and proposes a fix. Fixed rules and a human decide what reaches production.
        </p>
        <div className="row small ink2" style={{ gap: 8 }}>
          <span className="badge outline">UCI Bike Sharing, hourly</span>
          <span className="badge outline">HistGradientBoostingRegressor</span>
          <span className="badge outline">trained on Jan–Mar 2011</span>
          <span className="badge outline">92 weeks replayed, Apr 2011 – Dec 2012</span>
          <span className="badge outline">true counts arrive 1 week late</span>
          {llm?.model && <span className="badge outline">agent LLM: {llm.model}</span>}
        </div>
      </section>

      <section className="stack">
        <div>
          <div className="eyebrow">The problem</div>
          <h2 style={{ marginTop: 4 }}>Same symptom, opposite fix</h2>
          <p className="ink2" style={{ marginTop: 6, maxWidth: 760 }}>
            In both cases this week's inputs no longer look like the training data. Only one of them should be fixed by
            retraining.
          </p>
        </div>
        <div className="grid-2">
          <ProblemCard
            tone="info"
            title="Genuine drift"
            example="Seasons change, and demand roughly triples over the 92 replayed weeks (weekly mean 68 → 325 rentals / hour)."
            signals={[
              'Weather features drift from the training window',
              'Error rises on clean, labelled weeks',
              'Data quality checks pass',
            ]}
            fix="Train a challenger on recent clean data and send it through the safety gate."
          />
          <ProblemCard
            tone="bad"
            title="Pipeline fault"
            example={
              <>
                Weeks 30–32: <code>temp</code> arrives in °C instead of normalised. Weeks 60–63: <code>hum</code>
                {' arrives empty.'}
              </>
            }
            signals={[
              '100% of temp values outside the valid range [0, 1]',
              'Weekly mean jumps 12–153 training std (seasons: ≤ 1.5)',
              'Error barely moves: not a reliable signal',
            ]}
            fix="Alert the data team and block retraining. Don't teach the model the bug."
          />
        </div>
      </section>

      <section className="stack">
        <div>
          <div className="eyebrow">How it works</div>
          <h2 style={{ marginTop: 4 }}>One loop, once a week</h2>
          <p className="ink2" style={{ marginTop: 6, maxWidth: 780 }}>
            The policy can only <b>propose</b>. Nothing changes the live model without passing the safety gate (unseen
            holdout week, clean data, at least 5% lower MAE) and a human approval.
          </p>
        </div>
        <div className="card card-pad">
          <LoopDiagram />
        </div>
        <div className="grid-4">
          {meta.data
            ? meta.data.policies.map((policy) => (
                <div
                  key={policy.name}
                  className="card card-pad"
                  style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                >
                  <div className="row" style={{ gap: 8 }}>
                    <span
                      className={`key-line${policy.name === 'never' ? ' dash' : ''}`}
                      style={{ color: policyColor(policy.name) }}
                    />
                    <strong>{policy.label}</strong>
                    <code className="tiny">{policy.name}</code>
                  </div>
                  <p className="small ink2">{policy.description}</p>
                </div>
              ))
            : [0, 1, 2, 3].map((i) => <Skeleton key={i} h={110} r={10} />)}
        </div>
      </section>

      <section className="stack">
        <div>
          <div className="eyebrow">Results</div>
          <h2 style={{ marginTop: 4 }}>92 weeks, the same faults, four policies</h2>
        </div>
        {comparison.isError ? (
          <ErrorBox error={comparison.error} what="the comparison" />
        ) : (
          <Results c={comparison.data} />
        )}
      </section>

      <section className="stack">
        <div>
          <div className="eyebrow">Findings worth knowing</div>
          <h2 style={{ marginTop: 4 }}>What the data taught us</h2>
        </div>
        <div className="grid-2">
          <Finding title="Error alone doesn't reveal the faults">
            The frozen model's MAE <i>dropped</i> during the °C bug (65 → 52): inflated temperatures push it into “hot
            weather” branches. Diagnosis needs the quality and jump checks.
          </Finding>
          <Finding title="Safety costs some accuracy">
            The rules make a third of the naive policy's retrains and none on faulty data, for about 14% more error:
            retraining is blocked during faults and the gate wants a 5% gain on a single week.
          </Finding>
          <Finding title="Here, the win is the right remedy">
            With this tree model, retraining on the faulty weeks raises later MAE only about 4–8%. The value of
            diagnosis is fixing the pipeline instead of the model, no model changes mid-incident, and an audit trail.
          </Finding>
          <Finding title="Textbook thresholds don't survive real data">
            A fixed PSI &gt; 0.2 or KS p &lt; 0.01 fires every week on autocorrelated hourly weather. Each feature's
            drift threshold is calibrated on the live model's own week-to-week noise.
          </Finding>
        </div>
      </section>

      <section className="card card-pad row" style={{ justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h3>See it for yourself</h3>
          <p className="small ink2" style={{ marginTop: 4 }}>
            Start with the comparison, then open a run week by week, or drive the loop live and approve the proposals.
          </p>
        </div>
        <div className="row">
          <a className="btn" href={href('dataset')}>
            Dataset
          </a>
          <a className="btn" href={href('compare')}>
            Compare policies
          </a>
          <a className="btn" href={href('explore', { run: 'eval:rules', week: 30 })}>
            Explore week 30
          </a>
          <a className="btn primary" href={href('live')}>
            Live demo <Icon name="arrow" />
          </a>
        </div>
      </section>
    </div>
  );
}
