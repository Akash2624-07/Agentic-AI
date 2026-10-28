import type { ReactNode } from 'react';
import { humanize } from '../lib/format';
import { ACTION_HELP, ACTION_TONE, CAUSE_HELP, CAUSE_TONE, type Tone } from '../lib/labels';
import { Icon } from './Icon';

interface BadgeProps {
  tone?: Tone;
  children?: ReactNode;
  title?: string;
  lg?: boolean;
}

export function Badge({ tone = 'neutral', children, title, lg }: BadgeProps) {
  return (
    <span className={`badge tone-${tone}${lg ? ' lg' : ''}`} title={title}>
      {children}
    </span>
  );
}

export function CauseBadge({ cause, lg }: { cause: string | null | undefined; lg?: boolean }) {
  if (!cause) return <span className="muted">-</span>;
  return (
    <Badge tone={CAUSE_TONE[cause] ?? 'neutral'} title={CAUSE_HELP[cause]} lg={lg}>
      {humanize(cause)}
    </Badge>
  );
}

export function ActionBadge({ action, lg }: { action: string | null | undefined; lg?: boolean }) {
  if (!action) return <span className="muted">-</span>;
  return (
    <Badge tone={ACTION_TONE[action] ?? 'neutral'} title={ACTION_HELP[action]} lg={lg}>
      {humanize(action)}
    </Badge>
  );
}

export function FaultBadge({ kinds }: { kinds: string[] | null | undefined }) {
  if (!kinds || kinds.length === 0) return null;
  return (
    <Badge tone="bad" title="Injected fault (ground truth, hidden from the policy)">
      <Icon name="alert" size={12} />
      {kinds.join(', ')}
    </Badge>
  );
}
