import { Metadata } from 'next';
import Link from 'next/link';
import { FileText, CheckCircle, ArrowRight, Play } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'Budget & Client Management | ForemanOS',
  description: 'Track project budgets by CSI division, manage change orders, and keep client information organized. Budget tracking built for construction project managers.',
};

export default function QuotesClientsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <LandingHeader />
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-6">
              <FileText className="w-8 h-8" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Budgets, Change Orders, and Client Records in One Place
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
              Track project budgets by cost code, log change orders as they happen, and keep client contact information and project history organized. No more scattered spreadsheets and email threads.
            </p>
          </div>

          <div className="relative w-full max-w-5xl mx-auto mb-16">
            <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700 flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500">Quotes Screenshot</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">What Changes When Budgets Are Centralized</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Budget vs. Actual by Cost Code</h3>
              <p className="text-gray-300">See where you&apos;re over and where you&apos;re under by CSI division. Change orders, invoices, and pay applications update the budget in real time instead of sitting in a spreadsheet until month-end.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Change Order Tracking</h3>
              <p className="text-gray-300">Log change orders as they happen with cost impact, approval status, and supporting documentation. No more change orders that don&apos;t make it into the budget until the draw meeting.</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Client and Project History</h3>
              <p className="text-gray-300">Contact information, project notes, and job history in one searchable record. When a past client calls about a new project, you have their full history without digging through email archives.</p>
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
                <h3 className="text-xl font-semibold mb-2">Set Up Your Budget</h3>
                <p className="text-gray-300">Enter budget line items by CSI division or create custom cost codes. AI can also extract budget data from uploaded documents to speed up setup.</p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">2</div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Log Costs as They Happen</h3>
                <p className="text-gray-300">Record change orders, invoices, and pay applications against budget items. The running total updates automatically so you always know where you stand.</p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-xl font-bold">3</div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Report with Confidence</h3>
                <p className="text-gray-300">Pull budget summaries for draw meetings, owner updates, or internal reviews. Data is always current because it&apos;s updated in real time, not reconstructed from spreadsheets.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Set Up Your First Project Budget</h2>
          <p className="text-xl text-blue-100 mb-8">
            Track budget vs. actual from day one. Free tier includes 1 project, no credit card required.
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