import { getProject } from '@/lib/data/get-project';
import SettingsPageContent from './settings-page-content';

export default async function ProjectSettingsPage({ params }: { params: { slug: string } }) {
  const { project } = await getProject(params.slug);
  return <SettingsPageContent projectSlug={project.slug} />;
}
