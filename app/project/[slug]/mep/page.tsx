import MEPDashboard from '@/components/mep/MEPDashboard';

export default function MEPPage({ params }: { params: { slug: string } }) {
  return <MEPDashboard projectSlug={params.slug} />;
}
