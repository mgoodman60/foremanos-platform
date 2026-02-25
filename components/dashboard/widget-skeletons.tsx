// NO 'use client' — these are server components used as Suspense fallbacks

export function WidgetSkeleton() {
  return (
    <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5">
      <div className="animate-pulse space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-700" />
          <div className="h-4 w-24 bg-gray-700 rounded" />
        </div>
        <div className="h-8 w-20 bg-gray-700 rounded" />
        <div className="h-3 w-32 bg-gray-700 rounded" />
      </div>
    </div>
  );
}

export function WideWidgetSkeleton() {
  return (
    <div className="md:col-span-2 bg-gray-800/40 border border-gray-700/50 rounded-xl p-5">
      <div className="animate-pulse space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-700" />
          <div className="h-4 w-32 bg-gray-700 rounded" />
        </div>
        <div className="h-8 w-24 bg-gray-700 rounded" />
        <div className="h-3 w-40 bg-gray-700 rounded" />
        <div className="flex gap-2">
          <div className="h-8 w-16 bg-gray-700 rounded-md" />
          <div className="h-8 w-16 bg-gray-700 rounded-md" />
        </div>
        <div className="h-2 bg-gray-700 rounded-full" />
      </div>
    </div>
  );
}

export function ActivitySkeleton() {
  return (
    <div className="bg-slate-900 border-2 border-gray-700 rounded-xl p-6">
      <div className="animate-pulse">
        <div className="h-5 w-32 bg-gray-700 rounded mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-[34px] h-[34px] rounded-full bg-gray-700" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-gray-700 rounded" />
                <div className="h-3 w-1/2 bg-gray-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardGridSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Greeting skeleton */}
      <div className="space-y-2 px-1">
        <div className="h-7 bg-gray-700 rounded w-2/5" />
        <div className="h-5 bg-gray-700/60 rounded w-3/5" />
      </div>
      {/* Quick actions skeleton */}
      <div className="flex gap-3 px-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 w-32 bg-gray-700 rounded-full" />
        ))}
      </div>
      {/* Widget grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className={`bg-gray-800/40 border border-gray-700/50 rounded-xl p-6 ${i === 1 ? 'md:col-span-2' : ''}`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gray-700" />
              <div className="h-4 w-24 bg-gray-700 rounded" />
            </div>
            <div className="h-8 w-20 bg-gray-700 rounded mb-2" />
            <div className="h-3 w-32 bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
