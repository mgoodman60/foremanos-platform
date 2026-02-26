import { BudgetPageContent } from './budget-page-content';

export default async function BudgetPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return <BudgetPageContent projectSlug={params.slug} />;
}
