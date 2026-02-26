import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { RendersPageContent } from '@/components/renders/RendersPageContent';

export default async function RendersPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-6 border-b border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-white">Renders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-generated architectural visualizations
          </p>
        </div>
      </div>
      <RendersPageContent projectSlug={params.slug} />
    </div>
  );
}
