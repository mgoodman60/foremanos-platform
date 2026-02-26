import MEPDashboard from '@/components/mep/MEPDashboard';

export default async function MEPPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return <MEPDashboard projectSlug={params.slug} />;
}
