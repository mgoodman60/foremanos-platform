"use client";

import { Construction, RefreshCw } from 'lucide-react';

interface MaintenancePageProps {
  message?: string;
}

export function MaintenancePage({ message }: MaintenancePageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-dark-card border border-gray-700 rounded-lg shadow-2xl p-8 text-center">
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <Construction className="w-24 h-24 text-orange-500" aria-hidden="true" />
            <RefreshCw className="w-8 h-8 text-orange-500 absolute bottom-0 right-0 animate-spin" aria-hidden="true" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-4">System Maintenance</h1>
        
        <p className="text-lg text-gray-300 mb-6">
          {message || 'Updating documents... Please check back in a few minutes'}
        </p>
        
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-sm text-blue-300">
            We&apos;re syncing the latest project documents from OneDrive. This usually takes just a minute or two.
          </p>
        </div>
        
        <button
          onClick={() => window.location.reload()}
          className="mt-6 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}
