export default function Loading() {
  return (
    <div className="min-h-screen bg-dark-surface">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-40 bg-gray-700 rounded" />
          <div className="h-4 w-56 bg-gray-700/60 rounded" />
        </div>
        <div className="mt-8 animate-pulse grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-800 border border-gray-700 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
