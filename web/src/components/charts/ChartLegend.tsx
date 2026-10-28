import type { ReactNode } from 'react';

export interface LegendItem {
  label: string;
  color?: string;
  dash?: boolean;
  /** Replaces the default line swatch. */
  marker?: ReactNode;
}

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <div className="chart-legend">
      {items.map((item) => (
        <span key={item.label}>
          {item.marker ?? <span className={`key-line${item.dash ? ' dash' : ''}`} style={{ color: item.color }} />}
          {item.label}
        </span>
      ))}
    </div>
  );
}
