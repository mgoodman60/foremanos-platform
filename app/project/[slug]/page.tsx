'use client';

import { useProject } from '@/components/layout/project-context';
import { ProjectOverview } from '@/components/dashboard/project-overview';
import { RecentActivityFeed } from '@/components/dashboard/recent-activity-feed';
import { AIInsightsCard } from '@/components/dashboard/ai-insights-card';
import OnboardingChecklist from '@/components/onboarding-checklist';
import { FeatureTip } from '@/components/feature-tip';
import { SkeletonProjectWorkspace } from '@/components/ui/skeleton-card';

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="bg-slate-900 border-2 border-gray-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gray-700" />
              <div className="h-4 w-24 bg-gray-700 rounded" />
            </div>
            <div className="h-8 w-20 bg-gray-700 rounded mb-2" />
            <div className="h-3 w-32 bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProjectPage() {
  const { project, loading } = useProject();

  if (loading || !project) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-full">
      {/* Onboarding for new projects */}
      <div className="px-3 sm:px-6 py-2">
        <OnboardingChecklist
          projectSlug={project.slug}
          onRefresh={() => {}}
          onOpenDocumentLibrary={() => {}}
        />
      </div>

      {/* Dashboard transition tip (shows once) */}
      <div className="px-3 sm:px-6">
        <FeatureTip
          id="dashboard-v2-intro"
          title="New Dashboard"
          description="Your project dashboard has been upgraded! All features are now accessible from the sidebar. Use the AI Assistant button or press Ctrl+\\ to chat."
          variant="highlight"
          position="inline"
        />
      </div>

      {/* Dashboard Widget Grid */}
      <ProjectOverview projectSlug={project.slug} projectId={project.id} />

      {/* Activity + Insights */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 px-6 pb-6">
        <div className="xl:col-span-2">
          <RecentActivityFeed projectSlug={project.slug} />
        </div>
        <div>
          <AIInsightsCard projectSlug={project.slug} projectId={project.id} />
        </div>
      </div>
    </div>
  );
}
