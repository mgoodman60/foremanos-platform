export default function Loading() {
  return (
    <div className="min-h-screen bg-dark-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-44 bg-gray-700 rounded" />
          <div className="h-4 w-32 bg-gray-700/60 rounded" />
        </div>
        <div className="mt-8 animate-pulse space-y-3">
          <div className="h-10 w-full bg-gray-800 border border-gray-700 rounded-lg" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 bg-gray-800 border border-gray-700 rounded-lg space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-4 w-28 bg-gray-700 rounded" />
                <div className="h-4 w-20 bg-gray-700/60 rounded" />
              </div>
              <div className="h-3 w-3/4 bg-gray-700/40 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
