'use client';

import { Metadata } from 'next';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Check, Play } from 'lucide-react';
import { toast } from 'sonner';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

export default function DemoPage() {
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    role: '',
    trade: '',
    crewSize: '',
    email: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast.success('Demo request received! We\'ll contact you within 24 hours.');
    setFormData({
      name: '',
      company: '',
      role: '',
      trade: '',
      crewSize: '',
      email: '',
    });
    setIsSubmitting(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <LandingHeader />
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center mb-12">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            See Your Plans Analyzed in Real Time
          </h1>
          <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
            We'll walk through ForemanOS using drawings from your trade. No generic demo -- you'll see how AI handles the documents your team works with every day.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Left Column - Form */}
          <div className="bg-gray-800/50 rounded-lg p-8 border border-gray-700">
            <h2 className="text-2xl font-bold mb-6">Book Your Walkthrough</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label htmlFor="company" className="block text-sm font-medium mb-2">
                  Company *
                </label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  required
                  value={formData.company}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                  placeholder="ABC Construction"
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium mb-2">
                  Role *
                </label>
                <select
                  id="role"
                  name="role"
                  required
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                >
                  <option value="">Select your role</option>
                  <option value="owner">Owner</option>
                  <option value="pm">Project Manager</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="ops">Operations</option>
                </select>
              </div>

              <div>
                <label htmlFor="trade" className="block text-sm font-medium mb-2">
                  Trade *
                </label>
                <select
                  id="trade"
                  name="trade"
                  required
                  value={formData.trade}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                >
                  <option value="">Select your trade</option>
                  <option value="gc">General Contracting</option>
                  <option value="electrical">Electrical</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="hvac">HVAC</option>
                  <option value="landscaping">Landscaping</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="crewSize" className="block text-sm font-medium mb-2">
                  Crew Size *
                </label>
                <select
                  id="crewSize"
                  name="crewSize"
                  required
                  value={formData.crewSize}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                >
                  <option value="">Select crew size</option>
                  <option value="1-5">1-5 people</option>
                  <option value="6-10">6-10 people</option>
                  <option value="11-25">11-25 people</option>
                  <option value="26+">26+ people</option>
                </select>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                  placeholder="john@company.com"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-8 py-4 bg-[#F97316] text-white rounded-lg font-semibold hover:bg-[#EA580C] transition-all text-lg min-h-[56px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSubmitting ? (
                  'Submitting...'
                ) : (
                  <>
                    Request a Demo
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400 mb-2">Not ready yet?</p>
              <Link
                href="/product-tour"
                className="text-[#F97316] hover:text-[#EA580C] font-medium inline-flex items-center"
              >
                <Play className="mr-2 w-4 h-4" />
                Watch the 2-Minute Tour
              </Link>
            </div>
          </div>

          {/* Right Column - What to Expect */}
          <div>
            <div className="bg-gray-800/30 rounded-lg p-8 border border-gray-700 mb-8">
              <h3 className="text-2xl font-bold mb-6">What Happens Next</h3>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold">1</div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">We Call Within 24 Hours</h4>
                    <p className="text-gray-300">A 15-30 minute walkthrough built around your trade, your crew size, and the types of drawings you work with.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold">2</div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Live Plan Analysis</h4>
                    <p className="text-gray-300">We'll upload a sample drawing set and show AI extraction, MEP analysis, and compliance checking in real time -- not slides.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold">3</div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">You Decide</h4>
                    <p className="text-gray-300">No pressure, no hard sell. If it's a fit, you can start with the free plan that same day. If not, no follow-up calls.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-lg p-8 border border-blue-700/50">
              <h3 className="text-xl font-bold mb-4">What Changes After Week One</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300">Field crews answer their own questions instead of calling the office</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300">RFIs drop because details are found before they become questions</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300">Owner meetings run smoother with instant access to any spec or drawing</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300">Code compliance gets checked during planning, not during inspection</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
