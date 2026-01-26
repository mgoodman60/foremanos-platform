import { Metadata } from 'next';
import Link from 'next/link';
import { Plug, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Integrations | ForemanOS',
  description: 'Connect ForemanOS with your existing tools. Integrations coming soon.',
};

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Hero */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-xl mb-6">
            <Plug className="w-8 h-8" />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            Integrations
          </h1>
          <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
            Connect ForemanOS with the tools you already use.
          </p>
        </div>
      </section>

      {/* Coming Soon Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800/50 rounded-lg p-12 border border-gray-700 text-center">
            <h2 className="text-3xl font-bold mb-6">Integrations Coming Soon</h2>
            <p className="text-xl text-gray-300 mb-8">
              We're working on integrations with popular construction tools including:
            </p>
            
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 mb-12">
              <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-700">
                <h3 className="font-semibold mb-2">QuickBooks</h3>
                <p className="text-sm text-gray-400">Accounting sync</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-700">
                <h3 className="font-semibold mb-2">Procore</h3>
                <p className="text-sm text-gray-400">Project management</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-700">
                <h3 className="font-semibold mb-2">BuilderTrend</h3>
                <p className="text-sm text-gray-400">Construction software</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-700">
                <h3 className="font-semibold mb-2">OneDrive</h3>
                <p className="text-sm text-gray-400">File storage</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-700">
                <h3 className="font-semibold mb-2">Dropbox</h3>
                <p className="text-sm text-gray-400">File storage</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-700">
                <h3 className="font-semibold mb-2">Slack</h3>
                <p className="text-sm text-gray-400">Team communication</p>
              </div>
            </div>

            <div className="bg-purple-900/20 rounded-lg p-6 border border-purple-700/50 mb-8">
              <h3 className="text-lg font-semibold mb-3">Need a Specific Integration?</h3>
              <p className="text-gray-300">
                Let us know what tools you use. We prioritize integrations based on customer needs.
              </p>
            </div>

            <Link
              href="/demo"
              className="inline-flex items-center justify-center px-8 py-4 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all text-lg min-h-[56px]"
            >
              Request a Demo
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
