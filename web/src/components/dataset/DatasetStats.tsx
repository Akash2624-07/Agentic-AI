import { useDatasetSummary } from '../../api/queries';
import { formatDate } from '../../lib/format';
import { Skeleton } from '../Skeleton';

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card card-pad stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-sub">{sub}</span>
    </div>
  );
}

export function DatasetStats() {
  const dataset = useDatasetSummary().data;
  if (!dataset) {
    return (
      <div className="grid-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} h={110} r={10} />
        ))}
      </div>
    );
  }
  return (
    <div className="grid-4">
      <Stat
        label="Hourly rows"
        value={dataset.rows.toLocaleString('en-US')}
        sub={`${formatDate(dataset.train.start)} – ${formatDate(dataset.replay.end)}`}
      />
      <Stat
        label="Training window"
        value={`${dataset.train.weeks} weeks`}
        sub={`${dataset.train.rows.toLocaleString('en-US')} rows, Jan–Mar 2011 · ${dataset.train.mean_cnt.toFixed(0)} rentals / hour on average`}
      />
      <Stat
        label="Replay"
        value={`${dataset.replay.weeks} weeks`}
        sub={`${dataset.replay.rows.toLocaleString('en-US')} rows · ${dataset.replay.mean_cnt.toFixed(0)} rentals / hour on average`}
      />
      <Stat
        label="Label delay"
        value={`${dataset.label_delay_weeks} week`}
        sub="True counts for a week arrive with the next week's batch"
      />
    </div>
  );
}
