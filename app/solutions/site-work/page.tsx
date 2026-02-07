import { Metadata } from 'next';
import Link from 'next/link';
import { Shovel, CheckCircle, ArrowRight, Play } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'ForemanOS for Site Work Contractors | Grading Plans, Utility Layouts, Earthwork Intelligence',
  description: 'Extract elevations, utility layouts, and earthwork quantities from your civil plans. AI-powered plan intelligence for site work and excavation contractors.',
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
              Grading Elevations, Utility Layouts, and Drainage Details -- from Your Civil Plans in Seconds
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
              Upload your C-sheets and ask "What's the invert elevation at MH-3?" or "Show me the storm drain routing." AI reads your grading and utility plans and answers with cited sheet references.
            </p>
          </div>
        </div>
      </section>

      {/* Challenges */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Site Work Contractors Know These Problems</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Hundreds of Elevations, One Specific Grade</h3>
              <p className="text-gray-300">The grading plan has 200 spot elevations and you need the finish floor elevation at building pad B. Contour lines overlap, the scale is tight, and the operator is waiting in the cab for an answer.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Utility Conflicts Discovered After Trenching</h3>
              <p className="text-gray-300">Storm, sanitary, water, gas, and electric -- each on a separate sheet from a different engineer. Your crew hits the gas line because nobody cross-referenced the civil and the utility plans before you started digging.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Earthwork Quantities Are a Guessing Game</h3>
              <p className="text-gray-300">Calculating cut and fill from contour plans. Estimating pipe trench volumes across a half-mile run. One wrong assumption on existing grade and your trucking costs double.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Specs Scattered Across Three Documents</h3>
              <p className="text-gray-300">Compaction requirements in Division 31, backfill specs in the geotech report, erosion control in the SWPPP. Your foreman needs the compaction percentage and nobody printed the spec section.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">AI That Reads Civil and Grading Plans</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">Elevation and Grading Extraction</h3>
              <p className="text-gray-300">Ask "What's the finish grade at building pad A?" or "What's the slope from MH-1 to MH-3?" AI reads your grading plans, profiles, and civil sheets, then answers with cited sheet references.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">Cross-Discipline Utility Search</h3>
              <p className="text-gray-300">Ask "Show me all utilities at station 15+00." ForemanOS searches across civil, grading, and utility sheets to show storm, sanitary, water, and electric in one answer. Catch conflicts before you trench.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">Earthwork and Pipe Takeoffs</h3>
              <p className="text-gray-300">AI extracts dimensions from site plans to help calculate cut/fill volumes and pipe trench quantities. Export to Excel for bid preparation. Faster than hand-scaling from contour plans.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features for Site Work */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Built for Site Work and Excavation</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Search Grading and Utility Plans Instantly</h3>
                <p className="text-gray-300">"What's the invert elevation at the catch basin on grid D-7?" or "Where does the 8-inch storm line connect?" AI searches every uploaded C-sheet and returns answers with exact page references.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">ADA Site Access Compliance</h3>
                <p className="text-gray-300">Ask "What's the ADA maximum slope for an accessible route?" or "What's the required landing size at a ramp?" Get cited code answers to keep site access inspections on track.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Weather Impact Tracking</h3>
                <p className="text-gray-300">Rain days destroy site work schedules. ForemanOS tracks weather delays, productivity impact by trade, and cost exposure. Document weather-related delays for schedule claims with real data.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Field Crew Access and Daily Reports</h3>
                <p className="text-gray-300">Operators and foremen pull up grading plans from the cab or the field trailer. Log daily cut/fill progress, equipment hours, and compaction test results. All synced to the project record.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Share Plans with Utility Subs and Surveyors</h3>
                <p className="text-gray-300">Role-based access keeps everyone on the same plan revision. Excavation crews, utility subs, and the surveyor all see the current set. No more "which version is this?"</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#F97316] to-[#EA580C]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Upload Your Civil Plans and Try It Free</h2>
          <p className="text-xl text-orange-100 mb-8">
            Ask your first grading elevation question in under 5 minutes. Free tier, no credit card required.
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
