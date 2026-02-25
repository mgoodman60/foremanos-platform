import { getProject } from '@/lib/data/get-project';
import DocumentsPageContent from './documents-page-content';

export default async function DocumentsPage({ params }: { params: { slug: string } }) {
  const { project, session } = await getProject(params.slug);

  return (
    <DocumentsPageContent
      project={project}
      userRole={session.user.role || 'guest'}
    />
  );
}
