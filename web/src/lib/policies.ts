export const POLICY_ORDER = ['never', 'on_alert', 'rules', 'agent'];

const POLICY_SERIES: Record<string, number> = { never: 1, on_alert: 2, rules: 3, agent: 4 };

export function policyColor(policy: string) {
  return `var(--s${POLICY_SERIES[policy] ?? 5})`;
}

/** The frozen model is drawn dashed. */
export function policyDash(policy: string) {
  return policy === 'never' ? '6 4' : undefined;
}

const POLICY_LABELS: Record<string, string> = {
  never: 'Never retrain',
  on_alert: 'Retrain on alert',
  rules: 'Rules',
  agent: 'LLM agent',
};

export const policyLabel = (policy: string) => POLICY_LABELS[policy] ?? policy;
