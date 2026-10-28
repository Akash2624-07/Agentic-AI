import { useDatasetSummary } from '../../api/queries';
import { formatDate } from '../../lib/format';
import { Badge } from '../Badge';
import { ChartCard } from '../ChartCard';
import { Skeleton } from '../Skeleton';

export function ColumnsCard() {
  const dataset = useDatasetSummary().data;
  return (
    <ChartCard
      title="Columns"
      sub="What the model uses, what it predicts, and what was removed"
      explain={{
        seeing: <>Every column of the hourly table and its role.</>,
        read: (
          <>
            <b>Features</b> go into the model, <b>cnt</b> is the target. Weather features are normalised to [0, 1],
            which is what makes a °C value detectable.
          </>
        ),
        notice: (
          <>
            casual + registered add up to cnt, so keeping them would leak the answer. yr is constant (0) in the
            training window, so the model can't learn from it.
          </>
        ),
      }}
    >
      {dataset ? (
        <div className="grid-2" style={{ padding: '12px 20px 20px', gap: 24, alignItems: 'start' }}>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Role</th>
                  <th>Meaning</th>
                </tr>
              </thead>
              <tbody>
                {dataset.columns.map((column) => (
                  <tr key={column.name}>
                    <td>
                      <code>{column.name}</code>
                    </td>
                    <td>
                      <Badge tone={column.role === 'target' ? 'good' : column.role === 'time' ? 'neutral' : 'info'}>
                        {column.role}
                      </Badge>
                    </td>
                    <td className="small">
                      {column.description}
                      {dataset.faults.some((fault) => fault.feature === column.name) && (
                        <span
                          className="tiny"
                          style={{ display: 'block', color: 'var(--fault-ink)', fontWeight: 600 }}
                        >
                          {'fault injected: '}
                          {dataset.faults
                            .filter((fault) => fault.feature === column.name)
                            .map((fault) => `weeks ${fault.start_week}–${fault.end_week}`)
                            .join(', ')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="stack" style={{ gap: 12 }}>
            <h4>Dropped</h4>
            {dataset.dropped.map((column) => (
              <div key={column.name} className="row" style={{ alignItems: 'baseline', flexWrap: 'nowrap', gap: 10 }}>
                <code style={{ textDecoration: 'line-through', flex: 'none' }}>{column.name}</code>
                <span className="small ink2">{column.why}</span>
              </div>
            ))}
            <h4 style={{ marginTop: 10 }}>Injected faults</h4>
            {dataset.faults.map((fault) => (
              <div key={fault.kind} className="callout warn small" style={{ padding: '10px 12px' }}>
                <b>{fault.label}</b>
                <div className="ink2">
                  weeks {fault.start_week}–{fault.end_week} · {formatDate(fault.start)} – {formatDate(fault.end)}
                  {' · '}
                  <code>{fault.kind}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ padding: 20 }}>
          <Skeleton h={240} />
        </div>
      )}
    </ChartCard>
  );
}
