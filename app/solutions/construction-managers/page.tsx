import { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardCheck, CheckCircle, ArrowRight, Play } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'ForemanOS for Construction Managers & Owner\'s Reps | Multi-Project Oversight',
  description: 'Executive dashboards, earned value tracking, and AI-powered document intelligence. Full project visibility for construction managers and owner\'s reps.',
};

export default function ConstructionManagersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Header */}
      <LandingHeader />
      
      {/* Hero */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#F97316] rounded-xl mb-6">
              <ClipboardCheck className="w-8 h-8" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Complete Project Visibility, Across Every Trade
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
              Track schedule variance, monitor budgets, and answer owner questions in real time. AI-powered dashboards and document intelligence purpose-built for construction managers and owner&apos;s reps.
            </p>
          </div>
        </div>
      </section>

      {/* Challenges */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">The Oversight Problem</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Owner Asks a Question, You Need an Hour</h3>
              <p className="text-gray-300">&quot;Where are we on budget?&quot; &quot;What&apos;s the schedule variance?&quot; You shouldn&apos;t have to dig through three spreadsheets and call two PMs to answer a basic status question.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Multi-Project Blind Spots</h3>
              <p className="text-gray-300">Managing four projects across different GCs, each with their own filing system. You can&apos;t compare performance metrics or spot which job is trending over budget.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Trade Coordination Bottlenecks</h3>
              <p className="text-gray-300">The MEP coordinator needs the latest structural, the curtain wall sub is waiting on shop drawing approval, and the GC says they never got the ASI. Documents in twelve different inboxes.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Reporting Takes Longer Than Managing</h3>
              <p className="text-gray-300">Weekly owner reports, monthly executive summaries, daily logs from the field. You spend more time assembling reports than acting on the information in them.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Project Intelligence at Your Fingertips</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">Executive Dashboard with KPIs</h3>
              <p className="text-gray-300">See schedule variance, cost performance index (CPI), and earned value metrics across all your projects. One screen, real-time numbers. No spreadsheet assembly required.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">AI Document Chat Across All Docs</h3>
              <p className="text-gray-300">Ask &quot;What&apos;s the curtain wall spec?&quot; or &quot;Show me the MEP rough-in schedule.&quot; AI searches plans, specs, RFIs, and submittals, then answers with cited page references.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">Owner-Ready Reporting</h3>
              <p className="text-gray-300">Generate daily, weekly, and executive reports from live project data. Budget summaries, schedule status, and field activity -- ready to send to the owner without manual assembly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features for Construction Managers */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Built for the CM and Owner&apos;s Rep Workflow</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Earned Value Management (EVM)</h3>
                <p className="text-gray-300">Track planned value, earned value, and actual cost in real time. CPI and SPI calculated automatically from budget and schedule data. Spot trends before they become problems.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Stakeholder Access Control</h3>
                <p className="text-gray-300">Share budget docs with the owner only, structural plans with all trades, and field photos with the inspector. Admin, client, and guest roles keep sensitive information where it belongs.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Weather Impact Analytics</h3>
                <p className="text-gray-300">Track weather delays by trade, measure productivity impact, and calculate cost exposure from weather events. Defend schedule claims with documented data instead of field notes.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">OneDrive Integration</h3>
                <p className="text-gray-300">One source of truth. Sync documents from OneDrive so owners, trades, and inspectors all work from the latest revision. No more &quot;which version is current?&quot;</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Mobile Access for Site Walks</h3>
                <p className="text-gray-300">Pull up any document, check field photos, or review punch list items from your phone during walk-throughs. Answer owner questions on the spot instead of &quot;I&apos;ll get back to you.&quot;</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#F97316] to-[#EA580C]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">See Your Project KPIs in One Dashboard</h2>
          <p className="text-xl text-orange-100 mb-8">
            Upload your project documents and get AI-powered insights in minutes. Free to start, no credit card required.
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
