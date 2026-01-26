/**
 * Scale Validation Page
 * Displays scale information and validation for a project
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import ScaleValidator from '@/components/scale-validator';
import { Button } from '@/components/ui/button';

export default function ScalesPage() {
  const params = useParams();
  const router = useRouter();
  const projectSlug = params.slug as string;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => router.push(`/project/${projectSlug}`)}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Project</span>
              </Button>
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Scale Validation</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Review and validate drawing scales across all sheets
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ScaleValidator projectSlug={projectSlug} />
      </div>
    </div>
  );
}
