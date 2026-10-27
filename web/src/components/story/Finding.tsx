import type { ReactNode } from 'react';

export function Finding({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="callout">
      <h3>{title}</h3>
      <p className="small">{children}</p>
    </div>
  );
}
