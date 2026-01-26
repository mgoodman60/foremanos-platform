import { Metadata } from 'next';
import Link from 'next/link';
import { Shovel, CheckCircle, ArrowRight, Play } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';

export const metadata: Metadata = {
  title: 'ForemanOS for Site Work Contractors',
  description: 'AI-powered document intelligence for site work contractors. Instant answers from grading plans, utility layouts, and site specs.',
};

export default function SiteWorkPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Header */}
      <LandingHeader />
      
      {/* Hero */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#F97316] rounded-xl mb-6">
              <Shovel className="w-8 h-8" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              For Site Work Contractors
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
              Stop hunting through grading plans. Get instant answers about elevations, utilities, and drainage from your site docs.
            </p>
          </div>
        </div>
      </section>

      {/* Challenges */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Common Pain Points</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Complex Grading Plans</h3>
              <p className="text-gray-300">Site plans with hundreds of elevations, contours, and spot grades—finding specific elevations wastes valuable time.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Utility Coordination</h3>
              <p className="text-gray-300">Storm, sanitary, water, gas, electric—utility layouts buried in separate sheets. Conflicts discovered too late cost money.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Spec Confusion</h3>
              <p className="text-gray-300">Compaction requirements in one doc, backfill specs in another, erosion control in a third—nothing centralized.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Field Access Issues</h3>
              <p className="text-gray-300">Crews on-site can't pull up plans or verify drainage slopes. Constant calls back to the office slow progress.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">How ForemanOS Helps</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">AI Document Chat</h3>
              <p className="text-gray-300">Ask "What's the elevation at grid B-4?" or "Show me the storm drain routing." Get instant answers from site plans with sheet citations.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">Smart OCR & Vision</h3>
              <p className="text-gray-300">Automatically extracts elevations, dimensions, and utility locations from grading and site plans.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">IBC & ADA Codes</h3>
              <p className="text-gray-300">Built-in building code reference. Check ADA slope requirements or site access standards instantly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features for Site Work */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Built for Site Work</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Instant Site Plan Search</h3>
                <p className="text-gray-300">"What's the slope from point A to B?" or "Where does the 8-inch storm line run?" — get answers in seconds from grading and utility plans.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Auto-Sync from OneDrive</h3>
                <p className="text-gray-300">Upload once, access everywhere. OneDrive integration keeps your field crews, surveyors, and GC in sync with latest site plans.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Utility Coordination</h3>
                <p className="text-gray-300">Ask "Show me all utilities at station 15+00." ForemanOS searches across civil, grading, and utility sheets to find everything in one answer.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">ADA Compliance</h3>
                <p className="text-gray-300">Ask site access questions: "What's the ADA requirement for walkway slope?" Get cited code answers to keep inspections smooth.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Team Collaboration</h3>
                <p className="text-gray-300">Share projects with excavation crews, utility subs, and surveyors. Control document access with role-based permissions.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#F97316] to-[#EA580C]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Ready to Stop Searching, Start Grading?</h2>
          <p className="text-xl text-orange-100 mb-8">
            See how AI-powered document intelligence works for site work contractors.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="inline-flex items-center justify-center px-8 py-4 bg-white text-[#F97316] rounded-lg font-semibold hover:bg-gray-100 transition-all text-lg min-h-[56px]">
              Start Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link href="/product-tour" className="inline-flex items-center justify-center px-8 py-4 bg-[#1F2328] text-white rounded-lg font-semibold hover:bg-black transition-all text-lg border-2 border-white/20 min-h-[56px]">
              <Play className="mr-2 w-5 h-5" />
              Watch 2-Min Tour
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
