import { Skeleton } from '../Skeleton';
import { CHART_HEIGHT } from './shared';

export function ChartSkeleton({ h = CHART_HEIGHT }: { h?: number }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <Skeleton h={18} w="45%" />
      <div style={{ height: 8 }} />
      <Skeleton h={12} w="70%" />
      <div style={{ height: 14 }} />
      <Skeleton h={h} />
    </div>
  );
}
