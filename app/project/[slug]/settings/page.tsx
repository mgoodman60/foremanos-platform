import { getProject } from '@/lib/data/get-project';
import SettingsPageContent from './settings-page-content';

export default async function ProjectSettingsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const { project } = await getProject(params.slug);
  return <SettingsPageContent projectSlug={project.slug} />;
}
