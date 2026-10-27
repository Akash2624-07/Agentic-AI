import { humanize } from '../lib/format';
import { Icon } from './Icon';

const CHECK_LABELS: Record<string, string> = {
  holdout_unseen: 'Holdout week unseen in training',
  data_quality_ok: 'Clean data (batch and holdout)',
  beats_champion: '≥5% lower MAE than live model',
  human_approved: 'Human approval',
  previous_better: 'Previous model ≥5% better (shadow)',
};

/** One safety-gate check; `passed` null means still waiting. */
export function CheckChip({ name, passed }: { name: string; passed: boolean | null | undefined }) {
  const tone = passed === true ? 'tone-good' : passed === false ? 'tone-bad' : 'tone-warn';
  const icon = passed === true ? 'check' : passed === false ? 'x' : 'wait';
  const state = passed === true ? 'passed' : passed === false ? 'failed' : 'waiting';
  return (
    <span className={`check-chip ${tone}`} title={`${humanize(name)}: ${state}`}>
      <Icon name={icon} size={14} />
      {CHECK_LABELS[name] ?? humanize(name)}
    </span>
  );
}
