import { Metadata } from 'next';
import Link from 'next/link';
import { Hammer, CheckCircle, ArrowRight, Play } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'ForemanOS for General Contractors | AI Plan Intelligence for GCs',
  description: 'Coordinate subs, track budgets, and get instant answers from plans and specs. AI-powered document intelligence built for general contractors.',
};

export default function GeneralContractorsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Header */}
      <LandingHeader />
      
      {/* Hero */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#F97316] rounded-xl mb-6">
              <Hammer className="w-8 h-8" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Run Tighter Jobs with AI-Powered Plan Intelligence
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
              Upload your plans and specs once. Ask questions, pull quantities, track budgets, and coordinate every sub from one platform.
            </p>
          </div>
        </div>
      </section>

      {/* Challenges */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Every GC Knows These Problems</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Buried in Submittals and RFIs</h3>
              <p className="text-gray-300">A plumber asks about the fixture schedule, the electrician needs panel specs, the owner wants a cost update. You spend your day digging instead of building.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Budget Surprises at the Worst Time</h3>
              <p className="text-gray-300">Change orders pile up, pay apps don't match the SOV, and you don't see the overrun until the draw meeting. Tracking costs across 15 subs in spreadsheets is a full-time job.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Schedule Slippage You Can't See Coming</h3>
              <p className="text-gray-300">The drywall crew shows up but framing isn't signed off. Critical path delays cascade because nobody caught the conflict two weeks ago.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Too Many Subs, Not Enough Visibility</h3>
              <p className="text-gray-300">Twelve trades, twelve different plan versions, twelve different communication channels. When the architect issues a revision, half your subs are still working off the old set.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">One Platform for the Entire Job</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">Ask Your Plans Anything</h3>
              <p className="text-gray-300">"What's the finish schedule for the lobby?" or "Show me the A/E parking requirements." AI reads your uploaded plans and specs, then answers with cited page references.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">Budget and Cost Tracking</h3>
              <p className="text-gray-300">Track budgets by CSI division, log change orders, manage pay applications, and see cost variance in real time. No more waiting until the draw meeting to find out you're over.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">Subcontractor Coordination</h3>
              <p className="text-gray-300">Share plans with role-based access. Subs see only their discipline sheets. Everyone works from the same current set, and you control who sees what.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features for GCs */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Built for How GCs Actually Work</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Quantity Takeoffs from Your Plans</h3>
                <p className="text-gray-300">Upload drawings and pull material quantities across disciplines. Export to Excel for bid leveling or send to your estimator. No more counting symbols by hand.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Schedule and Critical Path Tracking</h3>
                <p className="text-gray-300">Gantt charts, look-ahead schedules, and weather-adjusted timelines. See where you're behind before the weekly OAC meeting, not after.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Daily Reports and Field Documentation</h3>
                <p className="text-gray-300">Log daily activities, weather conditions, labor counts, and field photos from any device. Reports sync automatically for PM review.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">RFIs, Punch Lists, and Code Compliance</h3>
                <p className="text-gray-300">Track open RFIs, manage punch list items, and check ADA or IBC requirements instantly with cited code sections. Keep inspections on track without the AHJ callback.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#F97316] to-[#EA580C]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Upload Your First Plan Set and See It Work</h2>
          <p className="text-xl text-orange-100 mb-8">
            Free tier includes 1 project and 50 AI queries. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="inline-flex items-center justify-center px-8 py-4 bg-white text-[#F97316] rounded-lg font-semibold hover:bg-gray-100 transition-all text-lg min-h-[56px]">
              Start Your First Project Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link href="/product-tour" className="inline-flex items-center justify-center px-8 py-4 bg-dark-surface text-white rounded-lg font-semibold hover:bg-black transition-all text-lg border-2 border-white/20 min-h-[56px]">
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
