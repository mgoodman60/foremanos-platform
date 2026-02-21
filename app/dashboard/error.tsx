'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
      <p className="text-gray-400">{error.message || 'An unexpected error occurred'}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
