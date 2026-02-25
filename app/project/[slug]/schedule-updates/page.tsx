import { getProject } from '@/lib/data/get-project';
import ScheduleUpdatesPageContent from './schedule-updates-page-content';

export default async function ScheduleUpdatesPage({ params }: { params: { slug: string } }) {
  const { project } = await getProject(params.slug);
  return <ScheduleUpdatesPageContent project={project} />;
}
