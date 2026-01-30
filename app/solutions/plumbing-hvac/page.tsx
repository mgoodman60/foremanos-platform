import { Metadata } from 'next';
import Link from 'next/link';
import { Wrench, CheckCircle, ArrowRight, Play } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';

export const metadata: Metadata = {
  title: 'ForemanOS for Plumbing & HVAC Contractors',
  description: 'AI-powered document intelligence for plumbing and HVAC contractors. Instant answers from plans, specs, and project files.',
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
              For Plumbing & HVAC Contractors
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
              Stop flipping through mechanical plans. Get instant answers about fixtures, ductwork, and pipe routing with AI.
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
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Complex Plan Sets</h3>
              <p className="text-gray-300">Mechanical, plumbing, and riser diagrams spread across dozens of sheets—hard to find what you need.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Scattered Specs</h3>
              <p className="text-gray-300">Fixture schedules in email, equipment specs in folders, submittals in texts—nothing centralized.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Code Questions</h3>
              <p className="text-gray-300">Unsure about plumbing code or HVAC sizing? Need quick answers without calling the inspector.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Crew Coordination</h3>
              <p className="text-gray-300">Field crew doesn't have access to latest plans or can't find critical details on-site.</p>
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
              <p className="text-gray-300">Ask "Where's the water heater?" or "What size is the supply line to fixture P-12?" Get instant answers with sheet references.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">Smart OCR & Vision</h3>
              <p className="text-gray-300">Automatically extracts fixture schedules, pipe sizes, and equipment details from mechanical plans.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">IPC & IMC Codes</h3>
              <p className="text-gray-300">Built-in plumbing and mechanical code reference. Get instant requirements with cited code sections.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features for Plumbing/HVAC */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Built for Mechanical Trades</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Instant Plan Search</h3>
                <p className="text-gray-300">"Show me all fixtures on the 2nd floor" or "What's the duct size for AHU-3?" — get answers in seconds.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Auto-Sync from OneDrive</h3>
                <p className="text-gray-300">Upload once, access everywhere. OneDrive integration keeps your entire team and GC in sync.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">ADA & IBC Compliance</h3>
                <p className="text-gray-300">Ask code questions: "What's the ADA requirement for sink heights?" Get cited answers instantly.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Team Collaboration</h3>
                <p className="text-gray-300">Share projects with field crew, GC, and engineers. Control who sees what with role-based access.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#F97316] to-[#EA580C]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Ready to Stop Searching, Start Building?</h2>
          <p className="text-xl text-orange-100 mb-8">
            See how AI-powered document intelligence works for plumbing and HVAC contractors.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="inline-flex items-center justify-center px-8 py-4 bg-white text-[#F97316] rounded-lg font-semibold hover:bg-gray-100 transition-all text-lg min-h-[56px]">
              Start Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link href="/product-tour" className="inline-flex items-center justify-center px-8 py-4 bg-dark-surface text-white rounded-lg font-semibold hover:bg-black transition-all text-lg border-2 border-white/20 min-h-[56px]">
              <Play className="mr-2 w-5 h-5" />
              Watch 2-Min Tour
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
