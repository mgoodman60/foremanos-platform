export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="animate-pulse flex items-center gap-4">
            <div className="h-8 w-8 bg-gray-700 rounded-lg" />
            <div className="h-8 w-48 bg-gray-700 rounded" />
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-4 border-b border-gray-700">
              <div className="space-y-2">
                <div className="h-4 w-40 bg-gray-700 rounded" />
                <div className="h-3 w-64 bg-gray-700/60 rounded" />
              </div>
              <div className="h-6 w-11 bg-gray-700 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
