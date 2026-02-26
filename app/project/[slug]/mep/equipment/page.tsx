import EquipmentList from '@/components/mep/EquipmentList';

export default async function EquipmentPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return <EquipmentList projectSlug={params.slug} />;
}
