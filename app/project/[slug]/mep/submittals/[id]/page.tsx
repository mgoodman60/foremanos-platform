import SubmittalDetail from '@/components/submittals/SubmittalDetail';

export default async function SubmittalDetailPage(
  props: { 
    params: Promise<{ slug: string; id: string }> 
  }
) {
  const params = await props.params;
  return <SubmittalDetail projectSlug={params.slug} submittalId={params.id} />;
}
