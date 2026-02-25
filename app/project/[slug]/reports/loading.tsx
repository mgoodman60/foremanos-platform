export default function Loading() {
  return (
    <div className="min-h-screen bg-dark-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-36 bg-gray-700 rounded" />
          <div className="h-4 w-48 bg-gray-700/60 rounded" />
        </div>
        <div className="mt-8 animate-pulse space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-gray-800 border border-gray-700 rounded-lg">
              <div className="h-4 w-24 bg-gray-700 rounded" />
              <div className="h-4 w-32 bg-gray-700/60 rounded" />
              <div className="ml-auto h-6 w-20 bg-gray-700 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
