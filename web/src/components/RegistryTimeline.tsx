import type { Fault, RegistryEvent } from '../api/types';
import { Icon } from './Icon';

const EVENT_ORDER = ['promote', 'rollback', 'reject', 'awaiting_approval', 'rollback_rejected', 'register'];

const EVENT_LABELS: Record<string, string> = {
  register: 'trained',
  promote: 'promoted',
  reject: 'rejected by gate',
  rollback: 'rolled back',
  awaiting_approval: 'awaiting approval',
  rollback_rejected: 'rollback rejected',
};

function EventMarker({ event, x, y }: { event: string; x: number; y: number }) {
  switch (event) {
    case 'promote':
      return (
        <path
          d={`M${x},${y - 7} L${x + 6},${y + 4} L${x - 6},${y + 4} Z`}
          fill="var(--s3)"
          stroke="var(--surface)"
          strokeWidth={1.5}
        />
      );
    case 'rollback':
      return (
        <path
          d={`M${x - 5},${y - 5} L${x + 5},${y + 5} M${x + 5},${y - 5} L${x - 5},${y + 5}`}
          stroke="var(--s2)"
          strokeWidth={2.75}
          strokeLinecap="round"
        />
      );
    case 'reject':
    case 'rollback_rejected':
      return <circle cx={x} cy={y} r={5} fill="var(--surface)" stroke="var(--s8)" strokeWidth={2} />;
    case 'awaiting_approval':
      return <circle cx={x} cy={y} r={5} fill="var(--s4)" stroke="var(--surface)" strokeWidth={2} />;
    default:
      return <circle cx={x} cy={y} r={3.5} fill="var(--muted)" />;
  }
}

interface RegistryTimelineProps {
  events: RegistryEvent[];
  faults: Fault[];
  nWeeks: number;
  onPick: (week: number) => void;
}

/** One lane per kind of registry event, weeks along x (SVG, 1000 units wide). */
export function RegistryTimeline({ events, faults, nWeeks, onPick }: RegistryTimelineProps) {
  const lanes = EVENT_ORDER.filter((event) => events.some((e) => e.event === event));
  const height = 24 + lanes.length * 34 + 26;
  // Week -1 (the initial model) gets a column of its own at the left.
  const x = (week: number) => 160 + ((week + 1.5) / (nWeeks + 1)) * 824;
  const ticks = Array.from({ length: Math.floor((nWeeks - 1) / 10) }, (_, i) => (i + 1) * 10);

  if (!lanes.length) return <div className="empty">No registry events.</div>;

  return (
    <div style={{ padding: '8px 12px 4px' }}>
      <svg viewBox={`0 0 1000 ${height}`} width="100%" role="img" aria-label="Model registry events by week">
        {faults.map((fault) => (
          <rect
            key={fault.kind}
            x={x(fault.start - 0.5)}
            y={10}
            width={x(fault.end + 0.5) - x(fault.start - 0.5)}
            height={lanes.length * 34 + 8}
            fill="var(--fault-fill)"
          />
        ))}
        {lanes.map((lane, laneIndex) => {
          const y = 24 + laneIndex * 34 + 17 - 6;
          const laneEvents = events.filter((e) => e.event === lane);
          return (
            <g key={lane}>
              <line x1={160} x2={984} y1={y} y2={y} stroke="var(--grid)" />
              <text x={150} y={y + 4} textAnchor="end" fontSize="12.5" fill="var(--ink-2)">
                {EVENT_LABELS[lane] ?? lane} ({laneEvents.length})
              </text>
              {laneEvents.map((e) => {
                const ex = x(e.week);
                return (
                  <g
                    key={e.seq}
                    style={{ cursor: e.week >= 0 ? 'pointer' : undefined }}
                    onClick={() => e.week >= 0 && onPick(e.week)}
                  >
                    <title>{`week ${e.week}: ${EVENT_LABELS[lane] ?? lane} v${e.version}${e.detail ? ` · ${e.detail}` : ''}${e.trained_on_faulty ? ' · trained on faulty data' : ''}`}</title>
                    <rect x={ex - 7} y={y - 12} width={14} height={24} fill="transparent" />
                    <EventMarker event={lane} x={ex} y={y} />
                    {e.trained_on_faulty ? <circle cx={ex} cy={y + 10} r={2} fill="var(--fault-ink)" /> : null}
                  </g>
                );
              })}
            </g>
          );
        })}
        {ticks.map((tick) => (
          <text key={tick} x={x(tick)} y={height - 6} textAnchor="middle" fontSize="11.5" fill="var(--muted)">
            {tick}
          </text>
        ))}
        <text x={x(-1)} y={height - 6} textAnchor="middle" fontSize="11.5" fill="var(--muted)">
          init
        </text>
      </svg>
      <div className="chart-legend" style={{ padding: '2px 8px 10px' }}>
        <span>
          <Icon name="info" size={13} /> Hover a marker for the detail, click it to open that week.
        </span>
        {events.some((e) => e.trained_on_faulty) && (
          <span>
            <svg width="8" height="8">
              <circle cx="4" cy="4" r="3" fill="var(--fault-ink)" />
            </svg>
            {' red dot = model trained on faulty weeks'}
          </span>
        )}
      </div>
    </div>
  );
}
