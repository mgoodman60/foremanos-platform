import { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardCheck, CheckCircle, ArrowRight, Play } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'Digital Forms & Checklists | ForemanOS',
  description: 'Replace clipboard paperwork with digital safety checklists, inspection forms, and punch lists. Fill out on-site, review in real time, never lose a form again.',
};

export default function FormsChecklistsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <LandingHeader />
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-6">
              <ClipboardCheck className="w-8 h-8" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Safety Checklists and Inspection Forms That Never Get Lost
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
              Your crew fills out forms on their phone. You see completed checklists, punch list items, and inspection results in real time. No more clipboard paperwork that sits in the truck until Friday.
            </p>
          </div>

          <div className="relative w-full max-w-5xl mx-auto mb-16">
            <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700 flex items-center justify-center">
              <div className="text-center">
                <ClipboardCheck className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500">Forms Screenshot</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Why Construction Teams Switch to Digital</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Every Form Accounted For</h3>
              <p className="text-gray-300">Safety checklists, QC inspections, and punch list items save automatically to the project record. Nothing sits in the truck bed, gets rained on, or disappears between the field and the office.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Real-Time Visibility for PMs</h3>
              <p className="text-gray-300">See completed forms the moment they're submitted. Know which safety checks are done, which inspections passed, and which punch list items are still open -- without calling the field.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Inspection-Ready Documentation</h3>
              <p className="text-gray-300">When the inspector asks for your pre-pour checklist or your safety meeting sign-in, it's already in the system. Organized, timestamped, and searchable. No scrambling through binders.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">How It Works</h2>
          <div className="space-y-8">
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">1</div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Set Up Your Forms</h3>
                <p className="text-gray-300">Create safety checklists, pre-pour inspections, punch lists, daily safety meeting sign-ins, or QC walk-through forms. Customize for your project needs.</p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">2</div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Crews Fill Out On-Site</h3>
                <p className="text-gray-300">Foremen and crew members complete forms from their phone or tablet. Attach photos, mark items pass/fail, and add notes. Works even with spotty cell service.</p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">3</div>
              <div>
                <h3 className="text-xl font-semibold mb-2">PMs Review in Real Time</h3>
                <p className="text-gray-300">Completed forms show up immediately in the project dashboard. Filter by date, type, or status. Export for meetings, audits, or your own records.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Try Digital Forms on Your Next Project</h2>
          <p className="text-xl text-blue-100 mb-8">
            Create your first checklist in minutes. Free tier includes 1 project, no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/demo" className="inline-flex items-center justify-center px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-all text-lg min-h-[56px]">
              Request a Demo
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link href="/product-tour" className="inline-flex items-center justify-center px-8 py-4 bg-blue-800 text-white rounded-lg font-semibold hover:bg-blue-900 transition-all text-lg border-2 border-blue-500 min-h-[56px]">
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