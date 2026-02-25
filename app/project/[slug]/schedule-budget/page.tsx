import { ScheduleBudgetContent } from './schedule-budget-content';

export default function ScheduleBudgetPage({ params }: { params: { slug: string } }) {
  return <ScheduleBudgetContent projectSlug={params.slug} />;
}
