import { Metadata } from 'next';
import Link from 'next/link';
import { LayoutDashboard, CheckCircle, ArrowRight, Play } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'Real-Time Project Dashboard | ForemanOS',
  description: 'Schedule variance, budget status, and field activity across all your jobs in one screen. Real-time KPIs and earned value metrics for construction project managers.',
};

export default function ProjectDashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <LandingHeader />
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-6">
              <LayoutDashboard className="w-8 h-8" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Budget, Schedule, and Field Activity in One Screen
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
              Stop assembling status updates from three different spreadsheets. See cost variance, schedule performance, open RFIs, and field activity across all your projects in real time.
            </p>
          </div>

          {/* Placeholder Screenshot */}
          <div className="relative w-full max-w-5xl mx-auto mb-16">
            <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700 flex items-center justify-center">
              <div className="text-center">
                <LayoutDashboard className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500">Dashboard Screenshot</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">What Changes When You Have a Real Dashboard</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Answer Owner Questions Instantly</h3>
              <p className="text-gray-300">"Where are we on budget?" "What's the schedule variance?" Instead of pulling data from three places, you open the dashboard and have the answer. During the call, not after.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Catch Cost Overruns Before the Draw</h3>
              <p className="text-gray-300">See budget vs. actual by CSI division, track change order impact, and monitor cost performance index (CPI) in real time. Know you're trending over before the monthly pay app, not after.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Track Schedule Health at a Glance</h3>
              <p className="text-gray-300">Earned value metrics, critical path status, and weather-impacted tasks -- all on one screen. SPI and CPI tell you whether you're ahead or behind without digging into the Gantt chart.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">How It Works</h2>
          <div className="space-y-8">
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">1</div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Set Up Your Projects</h3>
                <p className="text-gray-300">Create projects with address, client, timeline, and budget. Upload your plan set and the AI starts extracting project intelligence immediately.</p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">2</div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Data Flows In from the Field</h3>
                <p className="text-gray-300">Daily reports, field photos, budget updates, and schedule progress feed the dashboard automatically. No manual re-entry from spreadsheets.</p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">3</div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Monitor from Anywhere</h3>
                <p className="text-gray-300">Open the dashboard from your phone at the job site, your tablet in the truck, or your desktop at the office. Same real-time data everywhere.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">See Your Project KPIs in One Place</h2>
          <p className="text-xl text-blue-100 mb-8">
            Create your first project and see the dashboard populate. Free tier, no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/demo"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-all text-lg min-h-[56px]"
            >
              Request a Demo
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link
              href="/product-tour"
              className="inline-flex items-center justify-center px-8 py-4 bg-blue-800 text-white rounded-lg font-semibold hover:bg-blue-900 transition-all text-lg border-2 border-blue-500 min-h-[56px]"
            >
              <Play className="mr-2 w-5 h-5" />
              Watch 2-Min Tour
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}