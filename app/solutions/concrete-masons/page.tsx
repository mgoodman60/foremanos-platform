import { Metadata } from 'next';
import Link from 'next/link';
import { HardHat, CheckCircle, ArrowRight, Play } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'ForemanOS for Concrete & Masonry Contractors | Rebar Schedules, Pour Sequences, Structural Intelligence',
  description: 'Extract rebar schedules, footing details, concrete mix specs, and pour sequences from your structural plans. AI-powered plan intelligence for concrete and masonry contractors.',
};

export default function ConcreteMasonsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Header */}
      <LandingHeader />
      
      {/* Hero */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#F97316] rounded-xl mb-6">
              <HardHat className="w-8 h-8" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Rebar Schedules, Footing Details, and Pour Specs -- Pulled from Your S-Sheets in Seconds
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
              Upload your structural plans and ask &quot;What&apos;s the rebar spacing for footing F-1?&quot; or &quot;Show me the concrete mix spec for the elevated slab.&quot; AI reads your S-sheets and answers with cited sheet references.
            </p>
          </div>
        </div>
      </section>

      {/* Challenges */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Concrete and Masonry Contractors Know These Problems</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Rebar Details Scattered Across 30 Sheets</h3>
              <p className="text-gray-300">The footing schedule is on S-101, the rebar detail is on S-501, and the structural notes reference a different bar spacing than what&apos;s on the plan. Your iron workers need a definitive answer before they tie steel.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Concrete Quantity Estimates Miss the Mark</h3>
              <p className="text-gray-300">Calculating cubic yards across multiple footings, grade beams, slabs, and walls from hand-scaled drawings. One missed dimension or wrong thickness and you&apos;re ordering short -- or eating the overrun on excess concrete.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Pour Sequence Conflicts</h3>
              <p className="text-gray-300">The engineer wants the north wall poured before the slab, but the GC&apos;s schedule has slab first. The pour sequence isn&apos;t clearly documented, and now your batch plant needs a revised schedule by tomorrow morning.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Finishers and Masons Can&apos;t Access Specs in the Field</h3>
              <p className="text-gray-300">Your crew needs the concrete mix spec, the masonry wall detail, or the grout schedule -- and it&apos;s buried in a Division 3 or Division 4 spec section nobody printed. Calls back to the office slow everything down.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">AI That Reads Structural Drawings</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">Rebar and Footing Detail Extraction</h3>
              <p className="text-gray-300">Ask &quot;What&apos;s the rebar spacing for footing F-3?&quot; or &quot;Show me the grade beam reinforcing detail.&quot; AI reads your structural plans, rebar schedules, and detail sheets, then answers with cited sheet references.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">Concrete and Masonry Takeoffs</h3>
              <p className="text-gray-300">AI extracts dimensions from foundation plans, walls, and slabs to calculate concrete volumes and masonry unit counts. Export to Excel with waste factors. Stop scaling drawings by hand for every bid.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">Spec and Mix Design Lookup</h3>
              <p className="text-gray-300">Ask &quot;What&apos;s the concrete mix spec for the elevated slab?&quot; or &quot;What&apos;s the masonry grout requirement?&quot; AI searches your uploaded specs and returns cited answers from Division 3 and Division 4 sections.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features for Concrete/Masons */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Built for Concrete and Masonry Workflows</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Search All Your Structural Sheets at Once</h3>
                <p className="text-gray-300">&quot;What&apos;s the depth of footing F-3?&quot; or &quot;Show me the wall section at grid C-4.&quot; AI searches every uploaded S-sheet and returns answers with exact page references. No more flipping through plan sets.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">IBC and ACI Code Compliance</h3>
                <p className="text-gray-300">Ask &quot;What&apos;s the IBC minimum for masonry wall thickness?&quot; or &quot;What&apos;s the ACI requirement for rebar cover in footings?&quot; Get cited code answers for inspections and quality control.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Field Crew Access to Plans and Specs</h3>
                <p className="text-gray-300">Iron workers, finishers, and masons pull up rebar schedules, mix specs, and structural details from their phones on-site. No more calling the office for the bar spacing on wall W-5.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Daily Pour Logs and Photo Documentation</h3>
                <p className="text-gray-300">Log pour dates, batch ticket numbers, slump test results, and weather conditions. Snap photos of formed and placed concrete. Build the inspection record as you work, not after the fact.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#F97316] to-[#EA580C]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Upload Your Structural Plans and Try It Free</h2>
          <p className="text-xl text-orange-100 mb-8">
            Ask your first rebar schedule question in under 5 minutes. Free tier, no credit card required.
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
