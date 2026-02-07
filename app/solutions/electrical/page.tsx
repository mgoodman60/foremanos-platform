import { Metadata } from 'next';
import Link from 'next/link';
import { Zap, CheckCircle, ArrowRight, Play } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'ForemanOS for Electrical Contractors | Panel Schedules, Load Calcs, E-Sheet Intelligence',
  description: 'Extract panel schedules, conduit routing, and load calculations from your E-sheets. AI-powered plan intelligence for electrical contractors.',
};

export default function ElectricalPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Header */}
      <LandingHeader />
      
      {/* Hero */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#F97316] rounded-xl mb-6">
              <Zap className="w-8 h-8" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Pull Panel Schedules and Circuit Details in Seconds
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
              Upload your E-sheets and ask questions like "What's the amp rating on panel EP-3?" or "Show me conduit routing to MCC-1." AI reads your electrical plans and answers with sheet references.
            </p>
          </div>
        </div>
      </section>

      {/* Challenges */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Problems Every EC Deals With</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ 40-Sheet E-Plans, One Panel Detail</h3>
              <p className="text-gray-300">You need the load schedule for panel LP-2A. It could be on E-201, E-401, or buried in the one-line diagram. You flip through every sheet and still aren't sure you found the latest revision.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Conduit Conflicts Discovered at Rough-In</h3>
              <p className="text-gray-300">Your conduit path runs right through the HVAC duct. Nobody caught the conflict on paper because the E-sheets and M-sheets were never coordinated until your crew was already in the ceiling.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Takeoff Counts Take Days</h3>
              <p className="text-gray-300">Counting receptacles, switches, and light fixtures across 30 sheets for a bid. One missed symbol on one sheet means your number is off and your margin disappears.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Journeymen Can't Access Plans in the Field</h3>
              <p className="text-gray-300">Your guys are in the ceiling asking "which circuit feeds this?" and nobody on-site has the latest panel schedule. They call the office, the office calls the PM, the PM digs through email.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">AI That Reads Electrical Drawings</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">Panel Schedule Extraction</h3>
              <p className="text-gray-300">Ask "What circuits are on panel EP-3?" or "What's the breaker size for the kitchen receptacle circuit?" AI reads your panel schedules, one-lines, and E-sheets, then answers with sheet references.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">MEP Clash Detection</h3>
              <p className="text-gray-300">ForemanOS traces conduit paths against ductwork, piping, and structural members using 3D path analysis. Catch conflicts before your crew is standing in the ceiling wondering what happened.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">Device and Fixture Takeoffs</h3>
              <p className="text-gray-300">AI counts receptacles, switches, fixtures, and panels from your uploaded plans. Export quantities to Excel with waste factors applied. Stop counting symbols by hand for every bid.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features for Electricians */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Built for the Electrical Trade</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Search Across All Your E-Sheets</h3>
                <p className="text-gray-300">"Show me all panels on the 2nd floor" or "What's the feeder size to MDP-1?" -- AI searches every uploaded electrical sheet and returns the answer with the exact page reference.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">ADA and Code Compliance Checks</h3>
                <p className="text-gray-300">Ask "What's the ADA requirement for switch height?" or "What's the clearance for a 200A panel?" Get cited code answers instantly. Keep inspections on track without the callback wait.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Field Crew Access</h3>
                <p className="text-gray-300">Journeymen pull up panel schedules, circuit details, and fixture specs from their phones on-site. No more calling the office for information that should be at their fingertips.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Daily Reports and Photo Documentation</h3>
                <p className="text-gray-300">Log rough-in progress, snap photos of above-ceiling work before close-up, and track labor by circuit or area. Documentation that protects you during inspections and change order disputes.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#F97316] to-[#EA580C]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Upload Your E-Sheets and Try It Free</h2>
          <p className="text-xl text-orange-100 mb-8">
            Ask your first question about a panel schedule in under 5 minutes. Free tier, no credit card required.
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