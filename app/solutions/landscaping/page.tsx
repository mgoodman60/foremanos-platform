import { Metadata } from 'next';
import Link from 'next/link';
import { Trees, CheckCircle, ArrowRight, Play } from 'lucide-react';

export const metadata: Metadata = {
  title: 'ForemanOS for Landscaping',
  description: 'Manage seasonal work, recurring maintenance, and crews for landscaping contractors.',
};

export default function LandscapingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Hero */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-xl mb-6">
              <Trees className="w-8 h-8" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              For Landscaping Contractors
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
              Keep crews on track, manage seasonal work, and never miss a maintenance visit.
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
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Seasonal Chaos</h3>
              <p className="text-gray-300">Spring hits and you're drowning in lawn care, mulching, and new installs.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Forgotten Maintenance</h3>
              <p className="text-gray-300">Miss a recurring mow or trim, customer calls upset.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Weather Delays</h3>
              <p className="text-gray-300">Rain throws off the whole week's schedule.</p>
            </div>
            <div className="bg-red-900/20 rounded-lg p-6 border border-red-700/50">
              <h3 className="text-xl font-semibold mb-3 text-red-400">❌ Crew Coordination</h3>
              <p className="text-gray-300">Different crews working different properties—hard to know who's where.</p>
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
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Route Planning</h3>
              <p className="text-gray-300">Map out crew routes by neighborhood—less drive time, more billable hours.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Recurring Job Automation</h3>
              <p className="text-gray-300">Set up weekly mows, biweekly trims—schedule repeats automatically.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Before/After Photos</h3>
              <p className="text-gray-300">Crews snap photos on site—show clients the work was done right.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features for Landscaping */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Built for Landscaping</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Recurring Service Scheduling</h3>
                <p className="text-gray-300">Automate mowing, trimming, and seasonal cleanups.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Crew Dispatch</h3>
                <p className="text-gray-300">Assign crews by property location, skill level, and equipment.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Weather-Responsive Rescheduling</h3>
                <p className="text-gray-300">Shift jobs when rain hits, notify customers automatically.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Photo Documentation</h3>
                <p className="text-gray-300">Capture before/after shots, attach to job records.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-green-600 to-green-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">See How It Works for Landscaping</h2>
          <p className="text-xl text-green-100 mb-8">
            Let's walk through a typical spring week.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/demo" className="inline-flex items-center justify-center px-8 py-4 bg-white text-green-600 rounded-lg font-semibold hover:bg-gray-100 transition-all text-lg min-h-[56px]">
              Request a Demo
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link href="/product-tour" className="inline-flex items-center justify-center px-8 py-4 bg-green-800 text-white rounded-lg font-semibold hover:bg-green-900 transition-all text-lg border-2 border-green-500 min-h-[56px]">
              <Play className="mr-2 w-5 h-5" />
              Watch 2-Min Tour
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}