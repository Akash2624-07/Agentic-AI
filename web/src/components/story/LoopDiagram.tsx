interface LoopStep {
  title: string;
  lines: string[];
  gate?: boolean;
  human?: boolean;
  live?: boolean;
}

const STEPS: LoopStep[] = [
  { title: 'Monitor', lines: ['quality · drift', 'jump · error'] },
  { title: 'Diagnose', lines: ['rules or LLM agent', '→ cause'] },
  { title: 'Propose', lines: ['alert / retrain', '/ roll back'] },
  { title: 'Safety gate', lines: ['fixed rules', 'no override'], gate: true },
  { title: 'Human', lines: ['approve', 'or reject'], human: true },
  { title: 'Live model', lines: ['serves next', 'week'], live: true },
];

function stepColors(step: LoopStep) {
  if (step.gate) return { fill: 'var(--t-good-bg)', stroke: 'var(--t-good-fg)', ink: 'var(--t-good-fg)' };
  if (step.human) return { fill: 'var(--t-warn-bg)', stroke: 'var(--t-warn-fg)', ink: 'var(--t-warn-fg)' };
  if (step.live) return { fill: 'var(--t-info-bg)', stroke: 'var(--t-info-fg)', ink: 'var(--t-info-fg)' };
  return { fill: 'var(--surface)', stroke: 'var(--border-strong)', ink: 'var(--ink)' };
}

/** The weekly loop, drawn left to right on wide screens and top to bottom on phones. */
export function LoopDiagram() {
  return (
    <figure style={{ margin: 0 }}>
      <svg className="loop-wide" viewBox="0 0 1000 250" width="100%" role="img" aria-labelledby="loop-title loop-desc">
        <title id="loop-title">The weekly feedback loop</title>
        <desc id="loop-desc">
          Each week a batch of 168 hourly rows arrives. Monitor checks it, Diagnose names a cause, Propose suggests an
          action, the safety gate checks fixed rules, a human approves, and only then does the live model change. True
          rental counts arrive one week late and feed back into Monitor.
        </desc>
        <defs>
          <marker
            id="arr"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-2)" />
          </marker>
          <marker
            id="arr-acc"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
          </marker>
        </defs>
        <text x="16" y="38" fontSize="12.5" fill="var(--ink-2)" fontWeight={600}>
          Weekly batch
        </text>
        <text x="16" y="55" fontSize="11.5" fill="var(--muted)">
          168 hourly rows, inputs only
        </text>
        <path
          d="M86 64 C 86 90, 86 95, 86 108"
          stroke="var(--ink-2)"
          strokeWidth="1.5"
          fill="none"
          markerEnd="url(#arr)"
        />
        {STEPS.map((step, i) => {
          const x = 16 + i * 164;
          const colors = stepColors(step);
          return (
            <g key={step.title}>
              <rect
                x={x}
                y={112}
                width={140}
                height={74}
                rx={10}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={1.25}
              />
              <text x={x + 70} y={138} textAnchor="middle" fontSize="15" fontWeight={650} fill={colors.ink}>
                {step.title}
              </text>
              {step.lines.map((line, j) => (
                <text key={line} x={x + 70} y={157 + j * 15} textAnchor="middle" fontSize="11.5" fill="var(--ink-2)">
                  {line}
                </text>
              ))}
              {i < STEPS.length - 1 && (
                <path
                  d={`M${x + 142} 149 L${x + 162} 149`}
                  stroke="var(--ink-2)"
                  strokeWidth="1.5"
                  markerEnd="url(#arr)"
                />
              )}
            </g>
          );
        })}
        <text x={578} y={100} textAnchor="middle" fontSize="11" fill="var(--muted)">
          blocked → nothing changes
        </text>
        <path
          d="M906 188 C 906 236, 880 236, 820 236 L 150 236 C 90 236, 86 230, 86 190"
          stroke="var(--accent)"
          strokeWidth="1.75"
          strokeDasharray="6 4"
          fill="none"
          markerEnd="url(#arr-acc)"
        />
        <rect x="356" y="226" width="288" height="20" rx="4" fill="var(--surface)" />
        <text x="500" y="240" textAnchor="middle" fontSize="12.5" fontWeight={600} fill="var(--accent)">
          true counts arrive one week late → error
        </text>
      </svg>
      <svg
        className="loop-narrow"
        viewBox="0 0 360 560"
        width="100%"
        role="img"
        aria-label="The weekly feedback loop: Monitor, Diagnose, Propose, Safety gate, Human, Live model; true counts arrive one week late and feed back into Monitor."
      >
        <defs>
          <marker
            id="arr2"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-2)" />
          </marker>
          <marker
            id="arr2-acc"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
          </marker>
        </defs>
        <text x="40" y="18" fontSize="12.5" fill="var(--ink-2)" fontWeight={600}>
          Weekly batch: 168 hourly rows
        </text>
        {STEPS.map((step, i) => {
          const y = 30 + i * 88;
          const colors = stepColors(step);
          return (
            <g key={step.title}>
              <rect
                x={40}
                y={y}
                width={230}
                height={64}
                rx={10}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={1.25}
              />
              <text x={155} y={y + 26} textAnchor="middle" fontSize="15" fontWeight={650} fill={colors.ink}>
                {step.title}
              </text>
              <text x={155} y={y + 46} textAnchor="middle" fontSize="12" fill="var(--ink-2)">
                {step.lines.join(' ')}
              </text>
              {i < STEPS.length - 1 && (
                <path
                  d={`M155 ${y + 66} L155 ${y + 86}`}
                  stroke="var(--ink-2)"
                  strokeWidth="1.5"
                  markerEnd="url(#arr2)"
                />
              )}
            </g>
          );
        })}
        <path
          d="M272 502 C 330 502, 330 490, 330 440 L 330 110 C 330 62, 320 62, 274 62"
          stroke="var(--accent)"
          strokeWidth="1.75"
          strokeDasharray="6 4"
          fill="none"
          markerEnd="url(#arr2-acc)"
        />
        <text
          x="344"
          y="280"
          fontSize="12"
          fill="var(--accent)"
          fontWeight={600}
          transform="rotate(90 344 280)"
          textAnchor="middle"
        >
          true counts, one week late
        </text>
      </svg>
      <style>
        {
          '.loop-narrow{display:none}@media (max-width:640px){.loop-wide{display:none}.loop-narrow{display:block;max-width:380px;margin:0 auto}}'
        }
      </style>
    </figure>
  );
}
