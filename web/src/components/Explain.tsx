import type { ReactNode } from 'react';

export interface ExplainProps {
  seeing: ReactNode;
  read: ReactNode;
  notice: ReactNode;
  top?: boolean;
}

/** The three-column "how to read this chart" footer of a card. */
export function Explain({ seeing, read, notice, top }: ExplainProps) {
  return (
    <div className={`explain${top ? ' top' : ''}`}>
      <div>
        <h4>What you're seeing</h4>
        {seeing}
      </div>
      <div>
        <h4>How to read it</h4>
        {read}
      </div>
      <div>
        <h4>What to notice</h4>
        {notice}
      </div>
    </div>
  );
}
