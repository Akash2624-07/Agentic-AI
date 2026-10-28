export type Tone = 'muted' | 'neutral' | 'info' | 'good' | 'warn' | 'serious' | 'bad';

export const CAUSE_TONE: Record<string, Tone> = {
  none: 'muted',
  noise: 'neutral',
  genuine_drift: 'info',
  pipeline_fault: 'bad',
  bad_update: 'serious',
  unclear: 'warn',
  unknown: 'warn',
};

export const ACTION_TONE: Record<string, Tone> = {
  none: 'muted',
  watch: 'neutral',
  alert: 'bad',
  escalate: 'warn',
  retrain: 'info',
  rollback: 'serious',
};

export const CAUSE_HELP: Record<string, string> = {
  none: 'Nothing to explain',
  noise: 'Signals moved, but not in a way that needs action',
  genuine_drift: 'The world changed (season, demand): the model may need retraining',
  pipeline_fault: "The data is broken: fix the pipeline, don't retrain on it",
  bad_update: 'A recent promotion made things worse',
  unclear: 'Evidence conflicts: a human should look',
  unknown: 'No diagnosis recorded',
};

export const ACTION_HELP: Record<string, string> = {
  none: 'No action',
  watch: 'Keep watching; nothing changes yet',
  alert: 'Alert the data team; retraining blocked',
  escalate: 'Hand the decision to a human',
  retrain: 'Train a challenger and send it through the safety gate',
  rollback: 'Propose returning to the previous model, through the gate',
};

export const PATH_LABELS: Record<string, string> = {
  llm: 'LLM',
  fast: 'fast path (quiet week)',
  scheduled: 'scheduled check',
  fallback: 'rules fallback',
};
