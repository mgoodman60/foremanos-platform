'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Calendar,
  DollarSign,
  ClipboardList,
  Building,
  Camera,
  Ruler,
  Activity,
  FileCheck,
} from 'lucide-react';

interface EmptyStateShellProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children?: React.ReactNode;
}

function EmptyStateShell({ icon: Icon, title, description, children }: EmptyStateShellProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-200 mb-2">{title}</h3>
      <p className="text-sm text-gray-400 max-w-sm mb-6">{description}</p>
      {children}
    </div>
  );
}

function DocumentsEmpty({ onUpload }: { onUpload?: () => void }) {
  return (
    <EmptyStateShell
      icon={FileText}
      title="No Documents Yet"
      description="Upload construction drawings, specs, or contracts to enable AI-powered document intelligence."
    >
      <Button
        onClick={onUpload}
        className="bg-orange-500 hover:bg-orange-600 text-white focus-visible:ring-2 focus-visible:ring-orange-500"
      >
        Upload First Document
      </Button>
      <p className="text-xs text-gray-500 mt-3">Supported: PDF, DOCX up to 200MB</p>
    </EmptyStateShell>
  );
}

function ScheduleEmpty({ projectSlug }: { projectSlug: string }) {
  return (
    <EmptyStateShell
      icon={Calendar}
      title="No Schedule Data"
      description="Upload a schedule document or create tasks to track project progress."
    >
      <Link href={`/project/${projectSlug}/schedule-budget`}>
        <Button className="bg-orange-500 hover:bg-orange-600 text-white focus-visible:ring-2 focus-visible:ring-orange-500">
          Go to Schedules
        </Button>
      </Link>
    </EmptyStateShell>
  );
}

function BudgetEmpty({ projectSlug }: { projectSlug: string }) {
  return (
    <EmptyStateShell
      icon={DollarSign}
      title="Budget Not Set Up"
      description="Set up your project budget to track costs, variance, and earned value."
    >
      <Link href={`/project/${projectSlug}/budget`}>
        <Button className="bg-orange-500 hover:bg-orange-600 text-white focus-visible:ring-2 focus-visible:ring-orange-500">
          Set Up Budget
        </Button>
      </Link>
    </EmptyStateShell>
  );
}

function DailyReportsEmpty({ projectSlug }: { projectSlug: string }) {
  return (
    <EmptyStateShell
      icon={ClipboardList}
      title="No Daily Reports"
      description="Track daily progress, crew hours, weather, and safety observations."
    >
      <div className="flex items-center gap-3">
        <Link href={`/project/${projectSlug}/field-ops/daily-reports`}>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white focus-visible:ring-2 focus-visible:ring-orange-500">
            Create First Report
          </Button>
        </Link>
        <Button
          variant="outline"
          className="border-gray-600 text-gray-300 hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          Submit via SMS
        </Button>
      </div>
    </EmptyStateShell>
  );
}

function RoomsEmpty({ onUpload }: { onUpload?: () => void }) {
  return (
    <EmptyStateShell
      icon={Building}
      title="No Rooms Found"
      description="Upload floor plan PDFs to automatically extract room data."
    >
      <Button
        onClick={onUpload}
        className="bg-orange-500 hover:bg-orange-600 text-white focus-visible:ring-2 focus-visible:ring-orange-500"
      >
        Upload Floor Plans
      </Button>
    </EmptyStateShell>
  );
}

function PhotosEmpty({ projectSlug }: { projectSlug: string }) {
  return (
    <EmptyStateShell
      icon={Camera}
      title="No Photos Yet"
      description="Capture field photos for progress tracking and AI safety analysis."
    >
      <Link href={`/project/${projectSlug}/photos`}>
        <Button className="bg-orange-500 hover:bg-orange-600 text-white focus-visible:ring-2 focus-visible:ring-orange-500">
          Go to Photos
        </Button>
      </Link>
    </EmptyStateShell>
  );
}

function TakeoffsEmpty({ projectSlug }: { projectSlug: string }) {
  return (
    <EmptyStateShell
      icon={Ruler}
      title="No Takeoffs"
      description="Takeoffs are auto-generated from document intelligence. Upload plans to get started."
    >
      <Link href={`/project/${projectSlug}/takeoffs`}>
        <Button className="bg-orange-500 hover:bg-orange-600 text-white focus-visible:ring-2 focus-visible:ring-orange-500">
          View Takeoffs
        </Button>
      </Link>
    </EmptyStateShell>
  );
}

function ActivityEmpty() {
  return (
    <EmptyStateShell
      icon={Activity}
      title="No Recent Activity"
      description="Activity will appear here as your team uploads documents, submits reports, and tracks progress."
    />
  );
}

function SubmittalsEmpty({ projectSlug }: { projectSlug: string }) {
  return (
    <EmptyStateShell
      icon={FileCheck}
      title="No Submittals"
      description="Track MEP submittals, reviews, and approvals."
    >
      <Link href={`/project/${projectSlug}/mep/submittals`}>
        <Button className="bg-orange-500 hover:bg-orange-600 text-white focus-visible:ring-2 focus-visible:ring-orange-500">
          Go to Submittals
        </Button>
      </Link>
    </EmptyStateShell>
  );
}

export const EmptyStates = {
  Documents: DocumentsEmpty,
  Schedule: ScheduleEmpty,
  Budget: BudgetEmpty,
  DailyReports: DailyReportsEmpty,
  Rooms: RoomsEmpty,
  Photos: PhotosEmpty,
  Takeoffs: TakeoffsEmpty,
  Activity: ActivityEmpty,
  Submittals: SubmittalsEmpty,
};
