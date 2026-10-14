import { cn } from '../../utils/cn.js'

export function Skeleton({ className }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-2xl bg-white/70', className)} />
}

export function PageSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-5">
      <span className="sr-only">Loading page</span>
      <Skeleton className="h-72 rounded-[28px]" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  )
}
