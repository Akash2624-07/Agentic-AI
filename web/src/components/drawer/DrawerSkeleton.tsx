import { Skeleton } from '../Skeleton';

export function DrawerSkeleton() {
  return (
    <div className="stack">
      <Skeleton h={14} w={90} />
      <div className="row">
        <Skeleton h={28} w={120} r={14} />
        <Skeleton h={28} w={100} r={14} />
      </div>
      <Skeleton h={40} />
      <Skeleton h={14} w={90} />
      <Skeleton h={180} />
    </div>
  );
}
