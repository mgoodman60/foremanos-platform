import { Metadata } from 'next';
import Link from 'next/link';
import { MessageSquare, CheckCircle, ArrowRight, Play } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'Team Communication & Collaboration | ForemanOS',
  description: 'Project-level communication with role-based access. Share plans with subs, coordinate with the GC, and keep the owner in the loop -- all tied to the job, not scattered in text threads.',
};

export default function TeamCommunicationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <LandingHeader />
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-6">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Project Communication That Stays With the Job
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
              Every conversation, document share, and update tied to the project -- not lost in text threads or buried in email chains. Role-based access controls who sees what across owners, GCs, subs, and inspectors.
            </p>
          </div>

          <div className="relative w-full max-w-5xl mx-auto mb-16">
            <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500">Communication Screenshot</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Why Project-Based Communication Works Better</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Role-Based Access Control</h3>
              <p className="text-gray-300">The owner sees budget summaries and progress photos. The GC sees the full project. Subs see only their discipline. Admin, client, and guest roles keep sensitive information where it belongs.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">One Source of Truth for Documents</h3>
              <p className="text-gray-300">Share plans via OneDrive sync, upload field photos, and attach specs to the project. When the architect issues a revision, everyone is looking at the same current set -- not three different email attachments.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Searchable Project History</h3>
              <p className="text-gray-300">Six months from now, when there&apos;s a warranty claim, you can search the project record by date, keyword, or team member. Every conversation, photo, and document is part of the permanent record.</p>
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
                <h3 className="text-xl font-semibold mb-2">Invite Your Team to the Project</h3>
                <p className="text-gray-300">Add team members with the right role -- admin for PMs, client for the owner, guest for inspectors. Each role sees only what they should.</p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">2</div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Share Documents and Updates</h3>
                <p className="text-gray-300">Upload plans, share field photos, and post project updates. Everything is tied to the project record. OneDrive integration keeps documents synced across all stakeholders.</p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">3</div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Search the Full Project Record</h3>
                <p className="text-gray-300">Find any document, photo, or conversation by date, keyword, or team member. When you need to look back at what was communicated three months ago, the record is complete and searchable.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Invite Your Team to a Project</h2>
          <p className="text-xl text-blue-100 mb-8">
            Set up role-based access for your next job. Free tier includes 1 project, no credit card required.
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