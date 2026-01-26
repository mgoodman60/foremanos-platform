import SubmittalDetail from '@/components/submittals/SubmittalDetail';

export default function SubmittalDetailPage({ 
  params 
}: { 
  params: { slug: string; id: string } 
}) {
  return <SubmittalDetail projectSlug={params.slug} submittalId={params.id} />;
}
