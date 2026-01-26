"use client";

import { Construction, RefreshCw } from 'lucide-react';

interface MaintenancePageProps {
  message?: string;
}

export function MaintenancePage({ message }: MaintenancePageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-2xl p-8 text-center">
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <Construction className="w-24 h-24 text-orange-500" />
            <RefreshCw className="w-8 h-8 text-blue-600 absolute bottom-0 right-0 animate-spin" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-800 mb-4">System Maintenance</h1>
        
        <p className="text-lg text-gray-600 mb-6">
          {message || 'Updating documents... Please check back in a few minutes'}
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            We're syncing the latest project documents from OneDrive. This usually takes just a minute or two.
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
