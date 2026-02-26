import MaintenanceScheduleView from '@/components/mep/MaintenanceSchedule';

export default async function MaintenancePage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return <MaintenanceScheduleView projectSlug={params.slug} />;
}
