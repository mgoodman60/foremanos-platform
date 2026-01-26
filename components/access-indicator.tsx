"use client";

import { Shield, ShieldCheck } from 'lucide-react';

interface AccessIndicatorProps {
  role: 'admin' | 'client' | 'guest';
}

export function AccessIndicator({ role }: AccessIndicatorProps) {
  const hasFullAccess = role === 'admin' || role === 'client';

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-full text-sm font-medium transition-all ${
        hasFullAccess
          ? 'bg-green-100 text-green-800 border border-green-300'
          : 'bg-blue-100 text-blue-800 border border-blue-300'
      }`}
      role="status"
      aria-label={hasFullAccess ? 'Full access mode - complete document access' : 'Guest access mode - limited document access'}
      title={hasFullAccess ? 'Full access to all documents' : 'Guest access - limited documents'}
    >
      {hasFullAccess ? (
        <ShieldCheck className="w-4 h-4" aria-hidden="true" />
      ) : (
        <Shield className="w-4 h-4" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">{hasFullAccess ? 'Full Access' : 'Guest Access'}</span>
      <span className="sm:hidden">{hasFullAccess ? 'Full' : 'Guest'}</span>
    </div>
  );
}
