import { getProject } from '@/lib/data/get-project';
import DocumentsPageContent from './documents-page-content';

export default async function DocumentsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const { project, session } = await getProject(params.slug);

  return (
    <DocumentsPageContent
      project={project}
      userRole={session.user.role || 'guest'}
    />
  );
}
