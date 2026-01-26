import { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardCheck, CheckCircle, ArrowRight, Play } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';

export const metadata: Metadata = {
  title: 'ForemanOS for Construction Managers & Owner\'s Reps',
  description: 'AI-powered project oversight for construction managers and owner\'s reps. Instant answers from project documents, real-time collaboration, and complete visibility.',
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
              For Construction Managers & Owner's Reps
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
              Stop chasing down documents across trades. Get instant project visibility and answers from all your documentation.
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
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Information Silos</h3>
              <p className="text-gray-300">Drawings from the architect, specs from the engineer, RFIs in email—critical project info scattered across dozens of sources.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Delayed Responses</h3>
              <p className="text-gray-300">Owners ask "What's the status?" or "Where are we on budget?" Hours wasted digging through files to answer simple questions.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Trade Coordination</h3>
              <p className="text-gray-300">Plumbers need updated MEP plans, electricians can't find the latest structural, masons waiting on specs—constant coordination bottleneck.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Version Control Chaos</h3>
              <p className="text-gray-300">Three versions of the same plan floating around—which one is current? Crews working off old drawings costs time and money.</p>
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
              <p className="text-gray-300">Ask "What's the schedule for MEP rough-in?" or "Show me parking requirements." Get instant answers from all project docs with citations.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">Real-Time Collaboration</h3>
              <p className="text-gray-300">Share projects with owners, architects, engineers, and trade contractors. Everyone sees the same up-to-date information.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-[#F97316] mb-4" />
              <h3 className="text-xl font-semibold mb-3">IBC & ADA Codes</h3>
              <p className="text-gray-300">Built-in building code reference. Verify compliance requirements instantly with cited code sections.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features for Construction Managers */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Built for Project Oversight</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Cross-Project Intelligence</h3>
                <p className="text-gray-300">"Where's the fire alarm layout?" or "What's the spec for the curtain wall?" — search across plans, specs, schedules, and RFIs instantly.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Auto-Sync from OneDrive</h3>
                <p className="text-gray-300">One source of truth. OneDrive integration keeps all stakeholders—owners, trades, inspectors—in sync with the latest documents.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Smart OCR & Vision</h3>
                <p className="text-gray-300">Automatically extracts dimensions, room numbers, and key details from plans. Find specific information without manually reading every sheet.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Role-Based Access Control</h3>
                <p className="text-gray-300">Share sensitive budget docs with owners only, structural plans with all trades. Control who sees what with granular permissions.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-[#F97316] rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Mobile Access from Job Site</h3>
                <p className="text-gray-300">On-site inspections or owner walk-throughs? Pull up any document on your phone. No more "I'll get back to you."</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#F97316] to-[#EA580C]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Ready for Complete Project Visibility?</h2>
          <p className="text-xl text-orange-100 mb-8">
            See how AI-powered document intelligence works for construction managers and owner's reps.
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
