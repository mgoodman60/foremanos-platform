import { Metadata } from 'next';
import Link from 'next/link';
import { Trees, CheckCircle, ArrowRight, Play } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'ForemanOS for Landscaping Contractors | Site Plans, Irrigation Layouts, Planting Intelligence',
  description: 'Extract planting schedules, irrigation layouts, and hardscape dimensions from your landscape plans. AI-powered plan intelligence for landscaping contractors.',
};

export default function LandscapingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <LandingHeader />
      {/* Hero */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-xl mb-6">
              <Trees className="w-8 h-8" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Planting Schedules, Irrigation Layouts, and Hardscape Specs -- from Your L-Sheets in Seconds
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
              Upload your landscape plans and ask "What's the plant count for zone 3?" or "Show me the irrigation head layout." AI reads your L-sheets and answers with cited sheet references.
            </p>
          </div>
        </div>
      </section>

      {/* Challenges */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Landscape Contractors Know These Problems</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Plant Counts Across 15 Sheets</h3>
              <p className="text-gray-300">Counting every tree, shrub, groundcover, and perennial across multiple zones. Miss one species on one sheet and your nursery order is wrong. Hand-counting takes a full day for a commercial project.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Irrigation Details Buried in the Plan Set</h3>
              <p className="text-gray-300">The irrigation layout is on L-401, the head schedule is on L-601, and the controller zone map is on a separate sheet. Your crew needs the GPM for zone 5 and nobody can find it.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Weather Disrupts the Install Schedule</h3>
              <p className="text-gray-300">Two days of rain and your planting window shifts. Sod delivery is already scheduled, the irrigation sub is booked next week, and the GC is pressuring you to finish before the CO inspection.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Hardscape Dimensions and Specs Scattered</h3>
              <p className="text-gray-300">Paver specs in Division 32, retaining wall details in the structural set, and the site plan shows different dimensions than the detail sheet. Your crew just needs the paver pattern and base depth.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">AI That Reads Landscape Plans</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Plant and Material Takeoffs</h3>
              <p className="text-gray-300">AI counts trees, shrubs, groundcovers, and hardscape materials from your uploaded landscape plans. Export quantities to Excel with waste factors for nursery orders and bid preparation.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Irrigation and Planting Schedule Lookup</h3>
              <p className="text-gray-300">Ask "What irrigation heads are in zone 3?" or "What's the planting spec for the courtyard?" AI reads your L-sheets, irrigation plans, and planting schedules, then answers with cited sheet references.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Before/After Photo Documentation</h3>
              <p className="text-gray-300">Crews snap progress photos on-site and attach them to the project record. Document site conditions before install, during grading, and after planting. Proof of work for the owner and the GC.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features for Landscaping */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Built for Landscape Installation Projects</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Search All Your L-Sheets at Once</h3>
                <p className="text-gray-300">"What species are specified for the parking island?" or "What's the paver detail for the plaza?" AI searches every uploaded landscape sheet and returns answers with exact page references.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Weather Delay Tracking</h3>
                <p className="text-gray-300">Rain days shift your planting window and push back sod delivery. ForemanOS tracks weather impacts, logs delay days, and documents productivity loss for schedule claims.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Crew Scheduling and Daily Reports</h3>
                <p className="text-gray-300">Schedule crews across projects, log daily work completed, and track labor hours by zone or area. Field reports sync automatically for PM review.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Budget Tracking for Install Projects</h3>
                <p className="text-gray-300">Track material costs, labor, and subcontractor expenses against your bid. See cost variance by category so you know where the margin is going before the project is over.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-green-600 to-green-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Upload Your Landscape Plans and Try It Free</h2>
          <p className="text-xl text-green-100 mb-8">
            Ask your first planting schedule question in under 5 minutes. Free tier, no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="inline-flex items-center justify-center px-8 py-4 bg-white text-green-600 rounded-lg font-semibold hover:bg-gray-100 transition-all text-lg min-h-[56px]">
              Start Your First Project Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link href="/product-tour" className="inline-flex items-center justify-center px-8 py-4 bg-green-800 text-white rounded-lg font-semibold hover:bg-green-900 transition-all text-lg border-2 border-green-500 min-h-[56px]">
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