import { Metadata } from 'next';
import Link from 'next/link';
import { Wrench, CheckCircle, ArrowRight, Play } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'ForemanOS for Plumbing & HVAC Contractors | Fixture Counts, Duct Sizing, MEP Intelligence',
  description: 'Extract fixture schedules, pipe sizes, duct layouts, and equipment specs from your mechanical plans. AI-powered plan intelligence for plumbing and HVAC contractors.',
};

export default function PlumbingHVACPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Header */}
      <LandingHeader />
      
      {/* Hero */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#F97316] rounded-xl mb-6">
              <Wrench className="w-8 h-8" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Fixture Counts, Duct Sizing, and Equipment Specs -- Without the Page Flipping
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
              Upload your P-sheets and M-sheets. Ask "What size is the supply to fixture P-12?" or "Show me the AHU-3 equipment schedule." AI reads your mechanical plans and answers with cited sheet references.
            </p>
          </div>
        </div>
      </section>

      {/* Challenges */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Mechanical Trade Pain Points</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Riser Diagrams Buried in 50-Sheet Plan Sets</h3>
              <p className="text-gray-300">You need the riser diagram for building B, but the mechanical set has 45 sheets and the plumbing has 30 more. The fixture schedule is on P-601, the pipe sizes are on P-201, and the equipment spec is in Division 23.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Duct and Pipe Conflicts at Install</h3>
              <p className="text-gray-300">Your 12-inch duct runs right into the plumber's 4-inch waste line. Nobody caught it on paper. Now you're both standing in the ceiling arguing about who routes around whom -- and the GC wants it resolved today.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Fixture and Equipment Counts for Bids</h3>
              <p className="text-gray-300">Counting every lavatory, water closet, floor drain, and roof drain across 25 sheets. Miss one fixture type on one floor and your bid is wrong. Do it by hand and it takes two days.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Submittal and Equipment Schedule Chaos</h3>
              <p className="text-gray-300">The AHU submittal is in the GC's email, the VAV box specs are in a shared drive, and the chiller schedule is in the mechanical spec book. Your foreman just needs the CFM rating for unit AC-4.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">AI That Understands Mechanical Drawings</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">Fixture and Equipment Extraction</h3>
              <p className="text-gray-300">Ask "How many floor drains on the 3rd floor?" or "What's the CFM for AHU-3?" AI reads fixture schedules, equipment schedules, and riser diagrams, then answers with cited sheet references.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">MEP Clash Detection</h3>
              <p className="text-gray-300">ForemanOS traces duct routing and pipe paths against other disciplines using 3D path analysis. Identify conflicts between plumbing waste lines, HVAC ductwork, and electrical conduit before install day.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">Plumbing and Mechanical Takeoffs</h3>
              <p className="text-gray-300">AI counts fixtures, equipment, and devices from your uploaded plans. Export to Excel with waste factors for bid preparation. Faster and more accurate than manual counting across 30+ sheet sets.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features for Plumbing/HVAC */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Built for Plumbing and HVAC Workflows</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Search All Your P-Sheets and M-Sheets at Once</h3>
                <p className="text-gray-300">"Show me all fixtures on the 2nd floor" or "What's the duct size for the return air to AHU-3?" -- AI searches every uploaded sheet and returns the answer with the exact page reference.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">ADA Compliance for Plumbing Fixtures</h3>
                <p className="text-gray-300">Ask "What's the ADA requirement for lavatory rim height?" or "What's the grab bar spacing for accessible water closets?" Get cited code answers that keep your rough-in right the first time.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Submittal and RFI Tracking</h3>
                <p className="text-gray-300">Track open submittals for equipment, manage RFIs about routing conflicts, and keep the GC in the loop with shared project access. No more "did you get the approved VAV box submittal?"</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Field Crew Access and Daily Reports</h3>
                <p className="text-gray-300">Fitters and pipefitters pull up riser diagrams and equipment specs on-site. Log daily progress, snap photos of rough-in work, and track labor by area. All synced to the project record.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#F97316] to-[#EA580C]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Upload Your Mechanical Plans and See It Work</h2>
          <p className="text-xl text-orange-100 mb-8">
            Ask your first fixture schedule question in under 5 minutes. Free tier, no credit card required.
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
