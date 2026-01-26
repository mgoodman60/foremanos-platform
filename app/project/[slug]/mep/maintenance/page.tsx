import MaintenanceScheduleView from '@/components/mep/MaintenanceSchedule';

export default function MaintenancePage({ params }: { params: { slug: string } }) {
  return <MaintenanceScheduleView projectSlug={params.slug} />;
}
