import type { ReactNode } from 'react';

interface PageHeadProps {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
}

export function PageHead({ eyebrow, title, children }: PageHeadProps) {
  return (
    <header className="page-head">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
      {children && <div className="lede">{children}</div>}
    </header>
  );
}
