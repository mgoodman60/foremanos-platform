import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { RenderGallery } from '@/components/renders/RenderGallery';
import { RenderWizard } from '@/components/renders/RenderWizard';

export default async function RendersPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
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
      <RenderGallery projectSlug={params.slug} />
      <RenderWizard projectSlug={params.slug} />
    </div>
  );
}
