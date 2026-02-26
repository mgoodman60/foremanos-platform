import { Suspense } from 'react';
import { getProject } from '@/lib/data/get-project';
import OnboardingChecklist from '@/components/onboarding-checklist';
import { FeatureTip } from '@/components/feature-tip';
import { DashboardToolbar } from '@/components/dashboard/dashboard-toolbar';
import { AskForemanWidget } from '@/components/dashboard/ask-foreman-widget';
import {
  HealthWidgetServer,
  ScheduleWidgetServer,
  BudgetWidgetServer,
  DocumentsWidgetServer,
  FieldOpsWidgetServer,
  SubmittalsWidgetServer,
  StatsWidgetServer,
  ActivityFeedServer,
} from '@/components/dashboard/server-widgets';
import {
  WidgetSkeleton,
  WideWidgetSkeleton,
  ActivitySkeleton,
} from '@/components/dashboard/widget-skeletons';

export default async function ProjectPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const { project, session } = await getProject(params.slug);
  const userName = session?.user?.username || undefined;

  return (
    <div className="min-h-full">
      {/* Onboarding for new projects */}
      <div className="px-3 sm:px-6 py-2">
        <OnboardingChecklist projectSlug={project.slug} />
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

      {/* Interactive toolbar: greeting, quick actions, upload, density, rescan */}
      <DashboardToolbar
        projectSlug={project.slug}
        projectId={project.id}
        userName={userName}
      />

      {/* Widget Grid — each widget streams independently */}
      <div className="px-5 pb-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Row 1: Health (1-col) + Schedule (2-col) */}
          <Suspense fallback={<WidgetSkeleton />}>
            <HealthWidgetServer projectId={project.id} projectSlug={project.slug} />
          </Suspense>
          <Suspense fallback={<WideWidgetSkeleton />}>
            <ScheduleWidgetServer projectId={project.id} projectSlug={project.slug} />
          </Suspense>

          {/* Row 2: Budget + Documents + Field Ops */}
          <Suspense fallback={<WidgetSkeleton />}>
            <BudgetWidgetServer projectId={project.id} projectSlug={project.slug} />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton />}>
            <DocumentsWidgetServer projectId={project.id} projectSlug={project.slug} />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton />}>
            <FieldOpsWidgetServer projectId={project.id} projectSlug={project.slug} />
          </Suspense>

          {/* Row 3: Submittals + Takeoffs + Rooms + Photos */}
          <Suspense fallback={<WidgetSkeleton />}>
            <SubmittalsWidgetServer projectId={project.id} projectSlug={project.slug} />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton />}>
            <StatsWidgetServer projectId={project.id} projectSlug={project.slug} />
          </Suspense>
        </div>
      </div>

      {/* Activity + AI Assistant */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 px-6 pb-6">
        <div className="xl:col-span-2">
          <Suspense fallback={<ActivitySkeleton />}>
            <ActivityFeedServer projectId={project.id} projectSlug={project.slug} />
          </Suspense>
        </div>
        <div>
          <AskForemanWidget projectSlug={project.slug} projectId={project.id} />
        </div>
      </div>
    </div>
  );
}
