interface SkeletonProps {
  h?: number;
  w?: number | string;
  r?: number;
}

export function Skeleton({ h = 16, w = '100%', r }: SkeletonProps) {
  return <div className="skel" style={{ height: h, width: w, borderRadius: r }} aria-hidden />;
}
