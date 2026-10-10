export default function Loading() {
  return (
    <div className="space-y-5 sm:space-y-6" role="status" aria-label="Loading">
      <div className="flex items-end justify-between">
        <div className="h-8 w-44 animate-pulse rounded-[10px] bg-surface-2" />
        <div className="h-9 w-28 animate-pulse rounded-full bg-surface-2" />
      </div>
      <div className="h-36 animate-pulse rounded-[16px] bg-surface-2" />
      <div className="grid gap-5 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8">
        <div className="hidden space-y-2 lg:block">
          <div className="h-9 animate-pulse rounded-xl bg-surface-2" />
          <div className="h-9 animate-pulse rounded-xl bg-surface-2" />
          <div className="h-9 animate-pulse rounded-xl bg-surface-2" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
          <div className="h-48 animate-pulse rounded-[16px] bg-surface-2" />
          <div className="h-48 animate-pulse rounded-[16px] bg-surface-2" />
          <div className="h-48 animate-pulse rounded-[16px] bg-surface-2" />
          <div className="h-48 animate-pulse rounded-[16px] bg-surface-2" />
        </div>
      </div>
    </div>
  );
}
