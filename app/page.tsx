import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { MaintenancePage } from '@/components/maintenance-page';
import { LandingHeader } from '@/components/landing/header';
import { Hero } from '@/components/landing/hero';
import { Features } from '@/components/landing/features';
import { Footer } from '@/components/landing/footer';
import { SalesChatbot } from '@/components/landing/sales-chatbot';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // Check maintenance mode
  const maintenance = await prisma.maintenanceMode.findUnique({
    where: { id: 'singleton' },
  });

  if (maintenance?.isActive) {
    return <MaintenancePage message={maintenance.message} />;
  }

  const session = await getServerSession(authOptions);

  // If user is logged in, redirect to dashboard
  if (session) {
    redirect('/dashboard');
  }

  // Show landing page for non-authenticated users
  return (
    <main id="main-content" className="min-h-screen">
      <LandingHeader />
      <Hero />
      <Features />
      <Footer />
      <SalesChatbot />
    </main>
  );
}
