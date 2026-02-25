import { BudgetPageContent } from './budget-page-content';

export default function BudgetPage({ params }: { params: { slug: string } }) {
  return <BudgetPageContent projectSlug={params.slug} />;
}
