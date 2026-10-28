import { useDatasetSummary } from '../../api/queries';
import type { DailyRow } from '../../api/types';

export function DemandNotice({ daily }: { daily: DailyRow[] | undefined }) {
  const dataset = useDatasetSummary().data;
  if (!daily || !dataset) return <>Loading…</>;

  const meanCount = (days: DailyRow[]) => days.reduce((sum, day) => sum + day.cnt, 0) / Math.max(1, days.length);
  const mean2011 = meanCount(daily.filter((day) => day.date.startsWith('2011')));
  const mean2012 = meanCount(daily.filter((day) => day.date.startsWith('2012')));

  return (
    <>
      The replay averages <b>{(dataset.replay.mean_cnt / dataset.train.mean_cnt).toFixed(1)}×</b> the training
      window's demand ({dataset.replay.mean_cnt.toFixed(0)} vs{' '}
      {dataset.train.mean_cnt.toFixed(0)} rentals / hour), and 2012 is {Math.round((mean2012 / mean2011 - 1) * 100)}%
      busier than 2011. A model must keep retraining, and error is tracked as WAPE (relative to demand), not raw MAE.
    </>
  );
}
