import { Metadata } from 'next';
import Link from 'next/link';
import { Shield, Lock, Server, Eye, FileCheck, ArrowRight } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'Security & Reliability | ForemanOS',
  description: 'Enterprise-grade security for construction data. Your project information is protected, backed up, and always available.',
};

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Header */}
      <LandingHeader />
      
      {/* Hero */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-xl mb-6">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            Your Plans Are Protected
          </h1>
          <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
            Construction documents contain bid-sensitive pricing, proprietary designs, and confidential project details. ForemanOS protects them with the same security standards used by banks and healthcare providers.
          </p>
        </div>
      </section>

      {/* Security Features */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Security Architecture</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-800/50 rounded-lg p-8 border border-gray-700">
              <Lock className="w-12 h-12 text-blue-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">AES-256 Encryption</h3>
              <p className="text-gray-300 mb-4">
                Every document, drawing, and data point is encrypted at rest with AES-256 and in transit with TLS 1.3. Your plans are unreadable to anyone without authorization.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• AES-256 encryption for stored documents and database records</li>
                <li>• TLS 1.3 for all API and browser connections</li>
                <li>• Encrypted object storage via Cloudflare R2</li>
              </ul>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-8 border border-gray-700">
              <Server className="w-12 h-12 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Automated Backups</h3>
              <p className="text-gray-300 mb-4">
                Your database is backed up daily with 30-day retention. Point-in-time recovery means we can restore your data to any moment within the last month.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• Automated daily database snapshots</li>
                <li>• 30-day rolling retention window</li>
                <li>• Point-in-time recovery to any second within retention period</li>
              </ul>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-8 border border-gray-700">
              <Eye className="w-12 h-12 text-purple-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Role-Based Access Control</h3>
              <p className="text-gray-300 mb-4">
                Three access levels (Admin, Client, Guest) with document-level visibility controls. Share budget docs with owners only, structural plans with all trades, and safety protocols with the whole site.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• Admin, Client, and Guest roles with distinct permissions</li>
                <li>• Per-document visibility settings</li>
                <li>• Complete audit trail of every login, upload, and query</li>
              </ul>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-8 border border-gray-700">
              <FileCheck className="w-12 h-12 text-orange-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Compliance & Authentication</h3>
              <p className="text-gray-300 mb-4">
                JWT-based authentication with secure session management. Rate limiting on all API endpoints prevents abuse. Security headers and CSP policies protect against XSS and injection attacks.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• SOC 2 Type II certified</li>
                <li>• GDPR compliant data handling</li>
                <li>• Rate-limited API endpoints (auth: 5 attempts/5 min)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Reliability */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Infrastructure You Can Count On</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-green-500 mb-2">99.9%</div>
              <p className="text-xl font-semibold mb-2">Uptime SLA</p>
              <p className="text-gray-400">Hosted on Vercel&apos;s edge network with serverless PostgreSQL. Your plans are accessible from the trailer or the jobsite.</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-500 mb-2">24/7</div>
              <p className="text-xl font-semibold mb-2">Monitoring</p>
              <p className="text-gray-400">Automated health checks on database, storage, and AI services. Issues are detected and addressed before they affect your team.</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-500 mb-2">&lt;1hr</div>
              <p className="text-xl font-semibold mb-2">Critical Response</p>
              <p className="text-gray-400">Priority incidents get immediate attention. Enterprise customers receive dedicated support channels and custom SLAs.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Data Ownership */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-lg p-8 border border-blue-700/50">
          <h2 className="text-2xl font-bold mb-4">Your Data Stays Yours</h2>
          <p className="text-gray-300 mb-4">
            Your construction documents are never sold, shared with third parties, or used to train AI models. You own your data completely. Export everything anytime, and if you leave ForemanOS, you take it all with you.
          </p>
          <ul className="space-y-2 text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Full data export available anytime</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>No vendor lock-in</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>You control access and permissions</span>
            </li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#F97316] to-[#EA580C]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Need More Detail on Our Security Posture?</h2>
          <p className="text-xl text-orange-100 mb-8">
            We&apos;re happy to walk through our infrastructure, compliance certifications, and data handling practices in a call tailored to your organization&apos;s requirements.
          </p>
          <Link
            href="/demo"
            className="inline-flex items-center justify-center px-8 py-4 bg-white text-[#F97316] rounded-lg font-semibold hover:bg-gray-100 transition-all text-lg min-h-[56px]"
          >
            Request a Demo
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
