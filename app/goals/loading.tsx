export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <div className="h-8 w-40 animate-pulse rounded-[10px] bg-surface-2" />
      <div className="h-32 animate-pulse rounded-[16px] bg-surface-2" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-24 animate-pulse rounded-[14px] bg-surface-2" />
        <div className="h-24 animate-pulse rounded-[14px] bg-surface-2" />
        <div className="h-24 animate-pulse rounded-[14px] bg-surface-2" />
      </div>
    </div>
  );
}
