import type { ReactNode } from 'react';
import { Explain, type ExplainProps } from './Explain';

interface ChartCardProps {
  title?: ReactNode;
  sub?: ReactNode;
  /** Controls at the right of the header. */
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
  explain?: ExplainProps;
}

export function ChartCard({ title, sub, right, children, className = '', explain }: ChartCardProps) {
  return (
    <section className={`card chart-card ${className}`}>
      {(title || right) && (
        <div className="card-head">
          {title && (
            <div style={{ flex: 1, minWidth: 220 }}>
              <h3>{title}</h3>
              {sub && (
                <div className="small muted" style={{ marginTop: 2 }}>
                  {sub}
                </div>
              )}
            </div>
          )}
          {right}
        </div>
      )}
      {children}
      {explain && <Explain {...explain} />}
    </section>
  );
}
