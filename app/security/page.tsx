import { Metadata } from 'next';
import Link from 'next/link';
import { Shield, Lock, Server, Eye, FileCheck, ArrowRight } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';

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
            Security & Reliability
          </h1>
          <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
            Your project data is protected, backed up, and always available when you need it.
          </p>
        </div>
      </section>

      {/* Security Features */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">How We Protect Your Data</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-800/50 rounded-lg p-8 border border-gray-700">
              <Lock className="w-12 h-12 text-blue-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Bank-Level Encryption</h3>
              <p className="text-gray-300 mb-4">
                All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Same standards used by financial institutions.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• End-to-end encryption</li>
                <li>• Secure API connections</li>
                <li>• Encrypted file storage</li>
              </ul>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-8 border border-gray-700">
              <Server className="w-12 h-12 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Daily Backups</h3>
              <p className="text-gray-300 mb-4">
                Automated daily backups with 30-day retention. Your data is safe even if something goes wrong.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• Automatic daily backups</li>
                <li>• 30-day retention period</li>
                <li>• Point-in-time recovery</li>
              </ul>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-8 border border-gray-700">
              <Eye className="w-12 h-12 text-purple-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Role-Based Access</h3>
              <p className="text-gray-300 mb-4">
                Control who sees what. Admins, project managers, and field crews see only what they need.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• Granular permissions</li>
                <li>• Project-level access control</li>
                <li>• Audit logs for all changes</li>
              </ul>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-8 border border-gray-700">
              <FileCheck className="w-12 h-12 text-orange-500 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Compliance Ready</h3>
              <p className="text-gray-300 mb-4">
                Built to meet industry standards for data protection and privacy.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• GDPR compliant</li>
                <li>• SOC 2 Type II certified</li>
                <li>• Regular security audits</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Reliability */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Built for Reliability</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-green-500 mb-2">99.9%</div>
              <p className="text-xl font-semibold mb-2">Uptime</p>
              <p className="text-gray-400">Your data is accessible when you need it.</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-500 mb-2">24/7</div>
              <p className="text-xl font-semibold mb-2">Monitoring</p>
              <p className="text-gray-400">We watch for issues around the clock.</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-500 mb-2">&lt;1hr</div>
              <p className="text-xl font-semibold mb-2">Response Time</p>
              <p className="text-gray-400">Critical issues get immediate attention.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Data Ownership */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-lg p-8 border border-blue-700/50">
          <h2 className="text-2xl font-bold mb-4">Your Data Is Yours</h2>
          <p className="text-gray-300 mb-4">
            We don't sell your data. We don't share it with third parties. You can export it anytime, and if you ever leave, you take everything with you.
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
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-green-600 to-green-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Have Security Questions?</h2>
          <p className="text-xl text-green-100 mb-8">
            Let's discuss your specific requirements.
          </p>
          <Link
            href="/demo"
            className="inline-flex items-center justify-center px-8 py-4 bg-white text-green-600 rounded-lg font-semibold hover:bg-gray-100 transition-all text-lg min-h-[56px]"
          >
            Request a Demo
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
