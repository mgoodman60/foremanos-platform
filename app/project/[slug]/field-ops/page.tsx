import { redirect } from 'next/navigation';

export default async function FieldOpsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  // Redirect to daily reports by default
  redirect(`/project/${params.slug}/field-ops/daily-reports`);
}
