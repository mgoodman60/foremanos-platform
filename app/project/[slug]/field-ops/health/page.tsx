import ProjectHealthWidget from '@/components/field-ops/ProjectHealthWidget';

export default async function HealthDashboardPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Project Health Dashboard</h1>
        <p className="text-gray-400 mt-1">Real-time project health metrics and alerts</p>
      </div>

      <ProjectHealthWidget projectSlug={params.slug} />
    </div>
  );
}
