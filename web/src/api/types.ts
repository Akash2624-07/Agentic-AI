// Response shapes of the FastAPI backend (`uvicorn src.api:app`), as the UI reads them.

export type PolicyName = 'never' | 'on_alert' | 'rules' | 'agent';

export type Cause =
  | 'none'
  | 'noise'
  | 'genuine_drift'
  | 'pipeline_fault'
  | 'bad_update'
  | 'unclear'
  | 'unknown';

export type Action = 'none' | 'watch' | 'alert' | 'escalate' | 'retrain' | 'rollback';

/** How the agent reached its decision. */
export type DecisionPath = 'llm' | 'fast' | 'scheduled' | 'fallback';

export type AlertName = 'quality' | 'drift' | 'jump' | 'error';

export type FaultKind = 'temp_celsius' | 'hum_missing';

export type RegistryEventName =
  | 'register'
  | 'promote'
  | 'reject'
  | 'rollback'
  | 'awaiting_approval'
  | 'rollback_rejected';

// GET /api/meta

export interface Fault {
  kind: FaultKind | string;
  label: string;
  feature: string;
  start: number;
  end: number;
}

export interface Thresholds {
  quality_max_rate: number;
  jump_max: number;
  unseen_max_rate: number;
  error_ratio: number;
  error_weeks: number;
  min_improvement: number;
  rollback_weeks: number;
  stale_weeks: number;
  window_weeks: number;
}

export interface PolicyInfo {
  name: PolicyName | string;
  label: string;
  description: string;
  uses_llm: boolean;
}

export interface LlmInfo {
  provider: string | null;
  model: string | null;
  configured: boolean;
}

export interface Meta {
  week0: string;
  n_weeks: number;
  faults: Fault[];
  thresholds: Thresholds;
  policies: PolicyInfo[];
  llm: LlmInfo;
  features: {
    calendar: string[];
    weather: string[];
    normalised: string[];
  };
}

// GET /api/runs

export interface RunInfo {
  run_id: string;
  policy: PolicyName | string;
  mode: 'eval' | 'live';
  created_at: string;
}

// GET /api/comparison

export type MetricValue = number | string | null;

export interface ComparisonMetric {
  key: string;
  label: string;
  help: string;
  /** "zero" means the target is 0. */
  better: 'lower' | 'higher' | 'zero' | 'none';
  /** Per policy. Fault-diagnosis metrics are "hit/total" strings. */
  values: Record<string, MetricValue>;
}

/** One week of error per policy: `{week, start, never: 0.21, rules: 0.19, ...}`. */
export interface ComparisonWeek {
  week: number;
  start: string;
  [policy: string]: number | string | null;
}

export interface ComparisonEvent {
  policy: string;
  week: number;
  event: 'promote' | 'rollback';
}

export interface Comparison {
  policies: string[];
  metrics: ComparisonMetric[];
  /** WAPE per week. */
  weekly: ComparisonWeek[];
  weekly_mae: ComparisonWeek[];
  events: ComparisonEvent[];
}

// GET /api/runs/{run_id}/signals

export interface SignalWeek {
  week: number;
  start: string;
  fault: string[];
  live_version: number;
  action: Action;
  cause: Cause;
  alerts: AlertName[];
}

/** One value per feature (missing when not measured that week). */
export interface SignalRow {
  week: number;
  [feature: string]: number | null | undefined;
}

export interface SignalBlock {
  features: string[];
  rows: SignalRow[];
}

/** The live model's error on a week whose labels have arrived. */
export interface ErrorPoint {
  week: number;
  ratio: number | null;
  wape: number | null;
  version: number;
  quality_ok: boolean;
}

export interface Signals {
  run_id: string;
  policy: string;
  weeks: SignalWeek[];
  quality: SignalBlock;
  drift: SignalBlock;
  unseen: SignalBlock;
  jump: SignalBlock;
  error: ErrorPoint[];
}

// GET /api/runs/{run_id}/decisions

export interface DecisionRow {
  week: number;
  start: string;
  live_version: number;
  fault: string[];
  alerts: AlertName[];
  cause: Cause | null;
  action: Action | null;
  reason: string;
  confidence: number | null;
  /** One-line gate summary, e.g. "v2 vs v1 on week 1: MAE 25.4 vs 29.3 (+13.1%), passed". */
  gate: string | null;
  challenger: number | null;
  promoted: boolean;
  rolled_back: boolean;
  mae: number | null;
  wape: number | null;
  path: DecisionPath | null;
}

// GET /api/runs/{run_id}/events

export interface RegistryEvent {
  seq: number;
  /** -1 for the initial model. */
  week: number;
  event: RegistryEventName;
  version: number;
  detail: string;
  train_weeks: string;
  trained_on_faulty: boolean;
}

// GET /api/runs/{run_id}/weeks/{week}

export type GateCheckName =
  | 'holdout_unseen'
  | 'data_quality_ok'
  | 'beats_champion'
  | 'human_approved'
  | 'previous_better';

export interface GateDetail {
  checks: Partial<Record<GateCheckName | string, boolean | null>>;
  passed: boolean;
  pending: boolean;
  reason: string;
  human?: { approved: boolean; note: string };
  champion?: number;
  /** Promotion gate. */
  challenger?: number;
  holdout_week?: number;
  champion_mae?: number;
  challenger_mae?: number;
  /** Rollback gate. */
  previous?: number;
  weeks?: number[];
  champion_wape?: number;
  previous_wape?: number;
}

export interface LabelledError {
  week: number;
  version: number;
  mae: number;
  wape: number;
  baseline_wape: number;
  ratio: number | null;
  quality_ok: boolean;
  shadow_version: number | null;
  shadow_wape: number | null;
}

export interface FeatureEvidence {
  feature: string;
  flags: Array<'quality' | 'drift' | 'jump'>;
  missing: number | null;
  out_of_domain: number | null;
  psi: number | null;
  psi_threshold: number | null;
  psi_ratio: number | null;
  unseen: number | null;
  jump: number | null;
  ks_pvalue: number | null;
}

export interface ToolCall {
  tool: string;
  args?: Record<string, unknown>;
  result: unknown;
  turn: number | null;
}

export interface AgentDetails {
  path: DecisionPath;
  fallback?: boolean;
  fallback_reason?: unknown;
  llm_model?: string;
  turns?: number | null;
  cached_turns?: number;
  confidence?: number | null;
  evidence?: string[];
  notes?: string[];
  tool_calls?: ToolCall[];
  corrected?: boolean;
  answer?: {
    cause: Cause;
    action: Action;
    confidence: number;
    evidence: string[];
  };
  raw_answer?: unknown;
}

export interface WeekDetail {
  row: DecisionRow;
  gate: GateDetail | null;
  error: LabelledError | null;
  features: FeatureEvidence[];
  details: AgentDetails | null;
}

// GET /api/dataset/summary

export interface DatasetColumn {
  name: string;
  role: 'time' | 'feature' | 'target';
  description: string;
}

export interface DatasetSplit {
  start: string;
  end: string;
  rows: number;
  weeks: number;
  mean_cnt: number;
}

export interface DatasetFault {
  kind: string;
  label: string;
  feature: string;
  start_week: number;
  end_week: number;
  start: string;
  end: string;
}

export interface DatasetSummary {
  name: string;
  rows: number;
  columns: DatasetColumn[];
  dropped: Array<{ name: string; why: string }>;
  train: DatasetSplit;
  replay: DatasetSplit;
  faults: DatasetFault[];
  label_delay_weeks: number;
}

// GET /api/dataset/daily

export interface DailyRow {
  date: string;
  cnt: number;
  /** Negative in the training window. */
  week: number;
  split: 'train' | 'replay';
  /** True daily means. */
  temp: number | null;
  hum: number | null;
  /** As the pipeline delivered them (null when the feed was empty). */
  temp_delivered: number | null;
  hum_delivered: number | null;
  fault: string[];
}

// GET /api/dataset/rows

export interface DatasetRow {
  timestamp: string;
  week: number;
  split: 'train' | 'replay';
  fault: string[];
  season: number;
  mnth: number;
  hr: number;
  holiday: number;
  weekday: number;
  workingday: number;
  weathersit: number;
  /** As delivered (faults applied). */
  temp: number | null;
  atemp: number;
  hum: number | null;
  windspeed: number;
  true_temp: number | null;
  true_hum: number | null;
  cnt: number;
}

export interface DatasetRowsPage {
  total: number;
  offset: number;
  rows: DatasetRow[];
}

// GET /api/live, and every POST /api/live/* response

export interface PendingCheck {
  check: GateCheckName | string;
  /** null while waiting (human_approved). */
  passed: boolean | null;
}

/** A proposal that passed the gate's rules and waits for the human. */
export interface PendingProposal {
  kind: 'promote' | 'rollback';
  reason: string;
  /** Shown as stat tiles (label → value); `proposal` is the title instead. */
  headline: { proposal?: string } & Record<string, string | number | boolean | null | undefined>;
  checks: PendingCheck[];
  gate_reason: string;
}

export interface LiveInactive {
  active: false;
}

export interface LiveSession {
  active: true;
  run_id: string;
  policy: string;
  /** Last replayed week; null before the first. */
  week: number | null;
  n_weeks: number;
  live_version: number;
  finished: boolean;
  pending: PendingProposal | null;
  /** The decision for `week`. */
  current: DecisionRow | null;
  /** Injected faults active in `week` (ground truth). */
  current_fault: string[];
  error: ErrorPoint[];
  events: RegistryEvent[];
  rows: DecisionRow[];
}

export type LiveState = LiveInactive | LiveSession;
