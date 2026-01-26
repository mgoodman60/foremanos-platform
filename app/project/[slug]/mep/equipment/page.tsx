import EquipmentList from '@/components/mep/EquipmentList';

export default function EquipmentPage({ params }: { params: { slug: string } }) {
  return <EquipmentList projectSlug={params.slug} />;
}
