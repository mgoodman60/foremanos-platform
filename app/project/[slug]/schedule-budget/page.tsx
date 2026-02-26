import { ScheduleBudgetContent } from './schedule-budget-content';

export default async function ScheduleBudgetPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return <ScheduleBudgetContent projectSlug={params.slug} />;
}
