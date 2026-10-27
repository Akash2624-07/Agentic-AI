import { policyColor, policyLabel } from '../../lib/policies';

export interface ResultBar {
  policy: string;
  value: number;
  text: string;
}

interface ResultCardProps {
  label: string;
  bars: ResultBar[];
  note?: string;
  /** Scale shares (0–1) against 1, not against the largest bar. */
  higherIsBetter?: boolean;
}

/** One metric as a small horizontal bar chart, one bar per policy. */
export function ResultCard({ label, bars, note, higherIsBetter }: ResultCardProps) {
  const max = Math.max(...bars.map((bar) => bar.value), higherIsBetter ? 1 : 0) || 1;
  return (
    <div className="card result-card">
      <div className="stat-label">{label}</div>
      <div className="vs">
        {bars.map((bar) => (
          <div key={bar.policy} className="vs-row">
            <span className="ink2 nowrap" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {policyLabel(bar.policy)}
            </span>
            <span className="vs-track">
              <span
                className="vs-bar"
                style={{ width: `${Math.max(1.5, (bar.value / max) * 100)}%`, color: policyColor(bar.policy) }}
              />
            </span>
            <span className="num" style={{ fontWeight: 650, minWidth: 36, textAlign: 'right' }}>
              {bar.text}
            </span>
          </div>
        ))}
      </div>
      {note && (
        <p className="small ink2" style={{ marginTop: 'auto' }}>
          {note}
        </p>
      )}
    </div>
  );
}
