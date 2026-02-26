import { getProject } from '@/lib/data/get-project';
import ScheduleUpdatesPageContent from './schedule-updates-page-content';

export default async function ScheduleUpdatesPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const { project } = await getProject(params.slug);
  return <ScheduleUpdatesPageContent project={project} />;
}
