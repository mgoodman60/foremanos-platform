import { redirect } from 'next/navigation';

export default function FieldOpsPage({ params }: { params: { slug: string } }) {
  // Redirect to daily reports by default
  redirect(`/project/${params.slug}/field-ops/daily-reports`);
}
