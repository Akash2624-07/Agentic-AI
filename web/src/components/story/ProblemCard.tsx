import type { ReactNode } from 'react';
import type { Tone } from '../../lib/labels';

interface ProblemCardProps {
  tone: Tone;
  title: string;
  example: ReactNode;
  signals: string[];
  fix: string;
}

export function ProblemCard({ tone, title, example, signals, fix }: ProblemCardProps) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className={`tone-${tone}`} style={{ padding: '12px 18px', fontWeight: 650, fontSize: 16 }}>
        {title}
      </div>
      <div className="card-pad stack" style={{ gap: 12 }}>
        <p className="ink2">{example}</p>
        <div>
          <div className="section-title" style={{ marginBottom: 4 }}>
            What the monitor sees
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }} className="small">
            {signals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="section-title" style={{ marginBottom: 4 }}>
            Right response
          </div>
          <p style={{ fontWeight: 600 }}>{fix}</p>
        </div>
      </div>
    </div>
  );
}
