import type { AgentDetails } from '../../api/types';
import { ToolCallStep } from './ToolCallStep';

/** How the agent decided this week: fallback, a shortcut, or its LLM investigation. */
export function AgentSection({ details }: { details: AgentDetails }) {
  const toolCalls = details.tool_calls ?? [];

  if (details.path === 'fallback') {
    return (
      <section>
        <div className="section-title">LLM agent</div>
        <div className="callout warn small">
          <b>Fallback: the rules decided this week.</b>{' '}
          {details.fallback_reason
            ? `Reason: ${String(details.fallback_reason)}`
            : "The LLM call failed or wasn't configured."}
        </div>
      </section>
    );
  }

  if (details.path === 'fast' || details.path === 'scheduled') {
    return (
      <section>
        <div className="section-title">LLM agent</div>
        <p className="small ink2">
          {details.path === 'fast'
            ? 'Quiet week: every signal was normal, so the agent skipped the LLM.'
            : 'Scheduled check: the live model was 4 weeks without a challenger, so one went to the gate without asking the LLM.'}
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="section-title">LLM agent's investigation</div>
      <div className="row small ink2" style={{ gap: 12, marginBottom: 10 }}>
        {details.llm_model && (
          <span>
            model <code>{details.llm_model}</code>
          </span>
        )}
        {details.turns !== undefined && details.turns !== null && <span>{details.turns} turns</span>}
        {details.confidence !== undefined && details.confidence !== null && (
          <span>
            confidence <b className="num">{details.confidence.toFixed(2)}</b>
            {details.confidence < 0.6 && ' (below 0.6: escalated)'}
          </span>
        )}
      </div>
      {details.evidence && details.evidence.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="small" style={{ fontWeight: 650, marginBottom: 4 }}>
            Evidence the agent cited
          </div>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            {details.evidence.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {details.notes && details.notes.length > 0 && (
        <div className="callout warn small" style={{ marginBottom: 12 }}>
          <b>Guardrail notes:</b> {details.notes.join('; ')}
        </div>
      )}
      {toolCalls.length > 0 && (
        <>
          <div className="small" style={{ fontWeight: 650, marginBottom: 6 }}>
            Tool calls, in order ({toolCalls.length})
          </div>
          <ol className="steps">
            {toolCalls.map((call, i) => (
              <ToolCallStep key={i} i={i + 1} call={call} />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
