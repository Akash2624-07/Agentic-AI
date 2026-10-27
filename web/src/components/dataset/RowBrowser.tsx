import { useState } from 'react';
import { useDatasetRows, type RowQuery } from '../../api/queries';
import type { DatasetRow } from '../../api/types';
import { href } from '../../lib/router';
import { Badge } from '../Badge';
import { ChartCard } from '../ChartCard';
import { ErrorBox } from '../ErrorBox';
import { Icon } from '../Icon';
import { Segmented } from '../Segmented';
import { Skeleton } from '../Skeleton';

const PAGE_SIZE = 100;

interface Column {
  key: keyof DatasetRow;
  label: string;
  num?: boolean;
  title?: string;
}

const COLUMNS: Column[] = [
  { key: 'timestamp', label: 'Hour' },
  { key: 'week', label: 'Week', num: true },
  { key: 'split', label: 'Split' },
  { key: 'season', label: 'season', num: true },
  { key: 'mnth', label: 'mnth', num: true },
  { key: 'hr', label: 'hr', num: true },
  { key: 'holiday', label: 'hol.', num: true, title: 'holiday' },
  { key: 'weekday', label: 'wday', num: true, title: 'weekday' },
  { key: 'workingday', label: 'work', num: true, title: 'workingday' },
  { key: 'weathersit', label: 'weather', num: true, title: 'weathersit' },
  { key: 'temp', label: 'temp', num: true, title: 'as delivered' },
  { key: 'atemp', label: 'atemp', num: true },
  { key: 'hum', label: 'hum', num: true, title: 'as delivered' },
  { key: 'windspeed', label: 'wind', num: true, title: 'windspeed' },
  { key: 'cnt', label: 'cnt', num: true, title: 'target: rentals in the hour' },
];

type Split = 'all' | 'train' | 'replay';

interface Sort {
  key: string;
  desc: boolean;
}

/** The hourly table, paged and sorted by the server. */
export function RowBrowser() {
  const [split, setSplit] = useState('');
  const [weekInput, setWeekInput] = useState('');
  const [faultOnly, setFaultOnly] = useState(false);
  const [sort, setSort] = useState<Sort | null>(null);
  const [page, setPage] = useState(0);

  const week = weekInput.trim() === '' || !Number.isFinite(Number(weekInput)) ? undefined : Math.trunc(Number(weekInput));
  const query: RowQuery = {
    offset: page * PAGE_SIZE,
    limit: PAGE_SIZE,
    split: split || undefined,
    week,
    fault_only: faultOnly || undefined,
    sort: sort?.key,
    desc: sort?.desc,
  };
  const rows = useDatasetRows(query);
  const total = rows.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstPage = () => setPage(0);

  // Clicking a header cycles through its first direction, the other one, and no sort.
  // cnt starts descending (busiest hours first), everything else ascending.
  const toggleSort = (key: string) => {
    firstPage();
    setSort((current) =>
      current?.key === key
        ? current.desc === (key === 'cnt')
          ? { key, desc: !current.desc }
          : null
        : { key, desc: key === 'cnt' },
    );
  };

  return (
    <ChartCard
      title="Browse the rows"
      sub="The hourly table as the model receives it. Corrupted cells are marked; hover one for the true value."
      right={
        <a className="btn sm" href={href('explore', { run: 'eval:rules', week: week ?? 30 })}>
          See how the loop handled week {week ?? 30} <Icon name="arrow" size={14} />
        </a>
      }
    >
      <div className="row" style={{ padding: '12px 20px', gap: 12 }}>
        <Segmented<Split>
          label="Split"
          value={(split || 'all') as Split}
          onChange={(value) => {
            setSplit(value === 'all' ? '' : value);
            firstPage();
          }}
          options={[
            { value: 'all', label: 'All' },
            { value: 'train', label: 'Train' },
            { value: 'replay', label: 'Replay' },
          ]}
        />
        <label className="row small" style={{ gap: 6 }}>
          Week
          <input
            className="input num"
            style={{ width: 84 }}
            type="number"
            min={-13}
            max={91}
            placeholder="all"
            value={weekInput}
            onChange={(event) => {
              setWeekInput(event.target.value);
              firstPage();
            }}
          />
        </label>
        <div className="row" style={{ gap: 4 }}>
          {[30, 60].map((faultWeek) => (
            <button
              key={faultWeek}
              type="button"
              className="chip"
              aria-pressed={week === faultWeek}
              onClick={() => {
                setWeekInput(week === faultWeek ? '' : String(faultWeek));
                firstPage();
              }}
            >
              week {faultWeek}
            </button>
          ))}
        </div>
        <label className="row small" style={{ gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={faultOnly}
            onChange={(event) => {
              setFaultOnly(event.target.checked);
              firstPage();
            }}
          />
          Faulty weeks only
        </label>
        <span className="spacer" />
        <span className="small ink2 num">
          {rows.data
            ? total === 0
              ? 'No rows'
              : `${(page * PAGE_SIZE + 1).toLocaleString()}–${Math.min(total, (page + 1) * PAGE_SIZE).toLocaleString()} of ${total.toLocaleString()}`
            : '…'}
        </span>
        <div className="row" style={{ gap: 4 }}>
          <button className="btn sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            <Icon name="chevron" size={12} className="flip" /> Prev
          </button>
          <button
            className="btn sm"
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page >= pages - 1}
          >
            Next <Icon name="chevron" size={12} />
          </button>
        </div>
      </div>
      {rows.isError && (
        <div style={{ padding: '0 20px 16px' }}>
          <ErrorBox error={rows.error} what="the rows" />
        </div>
      )}
      <div
        className={`table-wrap ${rows.isFetching ? 'dim' : ''}`}
        style={{ maxHeight: 520, borderTop: '1px solid var(--border)', borderRadius: '0 0 10px 10px' }}
      >
        <table className="t compact">
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className={column.num ? 'r' : undefined}
                  title={column.title}
                  aria-sort={sort?.key === column.key ? (sort.desc ? 'descending' : 'ascending') : 'none'}
                >
                  <button className="sort-btn" onClick={() => toggleSort(column.key)}>
                    {column.label}
                    <span aria-hidden style={{ opacity: sort?.key === column.key ? 1 : 0.25 }}>
                      {sort?.key === column.key ? (sort.desc ? '↓' : '↑') : '↕'}
                    </span>
                  </button>
                </th>
              ))}
              <th>Fault</th>
            </tr>
          </thead>
          <tbody>
            {rows.data
              ? rows.data.rows.map((row) => (
                  <tr key={row.timestamp} className={row.fault.length ? 'fault-row' : undefined}>
                    {COLUMNS.map((column) => (
                      <RowCell key={column.key} row={row} col={column.key} num={column.num} />
                    ))}
                    <td>{row.fault.length ? <Badge tone="bad">{row.fault.join(', ')}</Badge> : null}</td>
                  </tr>
                ))
              : Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={COLUMNS.length + 1}>
                      <Skeleton h={14} />
                    </td>
                  </tr>
                ))}
            {rows.data && rows.data.rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="empty">
                  No rows match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

/** One cell; delivered temp/hum that differ from the truth are marked, with the truth on hover. */
function RowCell({ row, col, num }: { row: DatasetRow; col: keyof DatasetRow; num?: boolean }) {
  const value = row[col];
  if (col === 'timestamp') {
    const timestamp = String(value);
    return (
      <td className="nowrap mono" style={{ fontSize: 12 }}>
        {timestamp.slice(0, 10)} {timestamp.slice(11, 16)}
      </td>
    );
  }
  if (col === 'split') {
    return <td className={value === 'train' ? 'train-cell' : 'ink2'}>{String(value)}</td>;
  }
  if (col === 'temp' && row.true_temp !== null && row.temp !== null && Math.abs(row.temp - row.true_temp) > 1e-9) {
    return (
      <td className="r num cell-bad" title={`Delivered ${row.temp}; true value ${row.true_temp} (normalised)`}>
        {row.temp.toFixed(2)}
      </td>
    );
  }
  if (col === 'hum' && row.hum === null && row.true_hum !== null) {
    return (
      <td className="r cell-bad" title={`Delivered: empty; true value ${row.true_hum}`}>
        empty
      </td>
    );
  }
  if (value == null) return <td className="r muted">-</td>;
  return (
    <td className={num ? 'r num' : undefined}>
      {typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : String(value)}
    </td>
  );
}
