import type { ToolCall } from '../../api/types';
import { humanize } from '../../lib/format';
import { Icon } from '../Icon';

const TOOL_HELP: Record<string, string> = {
  get_monitoring_report: "reads this week's signals, labels and model state",
  check_data_quality: 'checks missing / out-of-range values and jumps',
  get_feature_importance: 'which features the live model relies on',
  compare_with_history: 'the last few weeks of signals and errors',
  train_challenger: 'trains a new model and sends it to the gate',
  propose_rollback: 'asks the gate to return to the previous model',
};

const MAX_RESULT_CHARS = 20_000;

/** One collapsible tool call: `tool(arg=value, …)` with its JSON result. */
export function ToolCallStep({ i, call }: { i: number; call: ToolCall }) {
  const args = Object.entries(call.args ?? {});
  const result = JSON.stringify(call.result, null, 2);
  const failed = !!call.result && typeof call.result === 'object' && 'error' in call.result;
  return (
    <li>
      <details>
        <summary>
          <span className="n">{i}</span>
          <span style={{ minWidth: 0 }}>
            <code style={{ background: 'transparent', padding: 0, fontWeight: 650 }}>
              {call.tool}(
              {args
                .map(([name, value]) => `${name}=${typeof value === 'string' ? JSON.stringify(value) : String(value)}`)
                .join(', ')}
              )
            </code>
            <span className="tiny muted" style={{ display: 'block' }}>
              {call.turn === null ? '' : `turn ${call.turn} · `}
              {TOOL_HELP[call.tool] ?? humanize(call.tool)}
              {failed && ' · refused / error'}
            </span>
          </span>
          <Icon name="chevron" size={14} className="chev" />
        </summary>
        <pre>{result && result.length > MAX_RESULT_CHARS ? `${result.slice(0, MAX_RESULT_CHARS)}\n…` : result}</pre>
      </details>
    </li>
  );
}
