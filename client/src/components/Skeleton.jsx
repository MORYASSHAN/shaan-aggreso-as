export function Skeleton({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-md bg-[linear-gradient(90deg,rgb(255_255_255/0.03),rgb(255_255_255/0.07),rgb(255_255_255/0.03))] bg-[length:200%_100%] animate-[shimmer_1.6s_linear_infinite] ${className}`}
    />
  );
}

export function SkeletonRows({ rows = 4 }) {
  return (
    <div className="flex flex-col gap-3 p-5" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
