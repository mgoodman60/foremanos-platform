import { Metadata } from 'next';
import Link from 'next/link';
import { Calendar, CheckCircle, ArrowRight, Play } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'Scheduling & Dispatch | ForemanOS',
  description: 'Gantt charts, look-ahead schedules, and weather-adjusted timelines for construction projects. Track critical path, schedule variance, and crew assignments in one place.',
};

export default function SchedulingDispatchPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <LandingHeader />
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-6">
              <Calendar className="w-8 h-8" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Gantt Charts, Look-Aheads, and Weather-Adjusted Schedules
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
              Build your project schedule, track critical path activities, assign crews, and see how weather delays affect the timeline. Everyone on the job sees the same schedule, updated in real time.
            </p>
          </div>

          <div className="relative w-full max-w-5xl mx-auto mb-16">
            <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700 flex items-center justify-center">
              <div className="text-center">
                <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500">Scheduling Screenshot</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">What Changes with a Real Construction Schedule</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">See the Critical Path</h3>
              <p className="text-gray-300">Know which activities drive the completion date. When the framing crew falls behind, you see exactly how it impacts drywall, MEP rough-in, and the CO inspection -- before it cascades.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Weather-Adjusted Timelines</h3>
              <p className="text-gray-300">Rain days push outdoor activities automatically. See the revised schedule after weather events without manually updating every task. Weather analytics tie directly to the schedule.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Three-Week Look-Aheads</h3>
              <p className="text-gray-300">Generate look-ahead schedules for subcontractor coordination meetings. Everyone sees what&apos;s coming up, what&apos;s behind, and what needs to happen this week to stay on track.</p>
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
                <h3 className="text-xl font-semibold mb-2">Build Your Project Schedule</h3>
                <p className="text-gray-300">Create tasks, set durations, define dependencies, and assign milestones. AI can also extract schedule data from uploaded project documents to accelerate setup.</p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">2</div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Track Progress Against the Baseline</h3>
                <p className="text-gray-300">Update task completion from the field. The Gantt chart updates in real time, showing variance between planned and actual progress. Schedule performance index (SPI) calculates automatically.</p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">3</div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Adjust for Reality</h3>
                <p className="text-gray-300">Weather delay? Inspector reschedule? Adjust the schedule and dependent tasks shift automatically. Generate updated look-aheads for the next coordination meeting.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Build Your First Project Schedule</h2>
          <p className="text-xl text-blue-100 mb-8">
            Set up milestones, track critical path, and see schedule variance. Free tier, no credit card required.
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