'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

import { ArrowRight, FileText, Brain, Clock, DollarSign, Shield, Zap, Target, Users, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

export default function AboutPage() {
  return (
    <main id="main-content" className="min-h-screen bg-white">
      <LandingHeader />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 py-20 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center"
          >
            <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Built by Builders, <span className="text-[#003B71]">for Builders</span>
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed mb-8">
              ForemanOS exists because construction teams deserve better than generic project management tools. Our Plan Intelligence Engine reads your drawings the way an experienced PM would -- extracting dimensions, tracing MEP systems, checking code compliance, and answering questions with cited sources. All in seconds, not hours.
            </p>
            <div className="flex items-center justify-center gap-6 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span>Automatic Plan Analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span>MEP Clash Detection</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span>Code Compliance Checking</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* The Problem */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="mb-4">
                <span className="inline-block px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-semibold mb-4">
                  The Problem
                </span>
              </div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Your Team Is Losing 10+ Hours a Week to Document Searches
              </h2>
              <div className="space-y-4 text-gray-600">
                <div className="flex items-start gap-3">
                  <Clock className="h-6 w-6 text-red-500 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">2-3 Hours Lost Every Day</p>
                    <p>Your PM is flipping through 200-page drawing sets to find one dimension, one spec note, one detail callout. That&apos;s $150+ in billable time burned daily on manual searching.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <DollarSign className="h-6 w-6 text-red-500 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">Missed Details Cost Real Money</p>
                    <p>A missed dimension triggers an RFI. An overlooked spec note causes rework. A code violation fails inspection. Each one costs days and thousands of dollars.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FileText className="h-6 w-6 text-red-500 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">Information Scattered Everywhere</p>
                    <p>Answers are buried across architectural plans, structural sheets, MEP drawings, specs, and submittals. Your team wastes time calling the office, texting the PM, or guessing in the field.</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* The Solution */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="mb-4">
                <span className="inline-block px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold mb-4">
                  Our Solution
                </span>
              </div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Ask a Question. Get the Answer with the Source.
              </h2>
              <div className="space-y-4 text-gray-600">
                <div className="flex items-start gap-3">
                  <Brain className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">Plan Intelligence Engine</p>
                    <p>Upload your drawings and AI automatically extracts title blocks, scales, symbols, dimensions, and cross-references. A 200-sheet drawing set becomes fully searchable in minutes.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Zap className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">MEP Clash Detection</p>
                    <p>Traces HVAC, plumbing, and electrical paths in 3D to find hard clashes and clearance violations between trades. Catch coordination issues on screen, not in the ceiling.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900">Code Compliance Checking</p>
                    <p>Ask about ADA, IBC, or NFPA requirements and get the exact code section, the calculation, and a pass/fail status against your plans. Stop Googling building codes.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Compliance Checking Section */}
      <section className="py-20 bg-white border-t border-gray-100">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="max-w-5xl mx-auto"
          >
            <div className="text-center mb-12">
              <span className="inline-block px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold mb-4">
                AI-Powered Compliance
              </span>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Catch Code Violations Before Inspections
              </h2>
              <p className="text-xl text-gray-600">
                ForemanOS automatically checks your plans against ADA, IBC, and NFPA standards—with exact code citations.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Before */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <h3 className="text-lg font-bold text-red-900 mb-3">❌ Before Regulatory Caching</h3>
                <div className="space-y-2 text-sm text-red-800">
                  <p><strong>User:</strong> &quot;What&apos;s the ADA parking requirement?&quot;</p>
                  <p className="bg-white border border-red-200 rounded p-3 mt-2">
                    <strong>Bot:</strong> &quot;I see 15 parking spaces on Sheet C-001.&quot;
                  </p>
                  <ul className="mt-3 space-y-1 text-xs">
                    <li>• No code citation</li>
                    <li>• No compliance check</li>
                    <li>• Manual code lookup required</li>
                  </ul>
                </div>
              </div>

              {/* After */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                <h3 className="text-lg font-bold text-green-900 mb-3">✓ With Compliance Checking</h3>
                <div className="space-y-2 text-sm text-green-800">
                  <p><strong>User:</strong> &quot;What&apos;s the ADA parking requirement?&quot;</p>
                  <p className="bg-white border border-green-200 rounded p-3 mt-2">
                    <strong>Bot:</strong> &quot;Per <strong>ADA 2010 Section 208.2</strong>: 1 accessible space per 25 spaces. Your plans show 15 spaces, requiring 1 accessible space. <strong className="text-green-700">✓ Compliant</strong> (1 shown on Sheet C-001).&quot;
                  </p>
                  <ul className="mt-3 space-y-1 text-xs">
                    <li>• Cites exact ADA section</li>
                    <li>• Shows calculation + compliance status</li>
                    <li>• References both code AND plans</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 text-center">
                <div className="text-3xl font-bold text-blue-900 mb-2">+20%</div>
                <div className="text-sm text-blue-700">Answer Accuracy on Code Questions</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 text-center">
                <div className="text-3xl font-bold text-green-900 mb-2">90%</div>
                <div className="text-sm text-green-700">Compliance Verification Success Rate</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 text-center">
                <div className="text-3xl font-bold text-purple-900 mb-2">+40%</div>
                <div className="text-sm text-purple-700">More Code Citations in Answers</div>
              </div>
            </div>

            {/* Supported Codes */}
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Supported Building Codes</h3>
              <div className="flex flex-wrap justify-center gap-3">
                <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                  ADA 2010 Standards
                </span>
                <span className="px-4 py-2 bg-indigo-100 text-indigo-800 rounded-full text-sm font-semibold">
                  IBC 2021 (Coming Soon)
                </span>
                <span className="px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                  NFPA 1 (Coming Soon)
                </span>
                <span className="px-4 py-2 bg-pink-100 text-pink-800 rounded-full text-sm font-semibold">
                  IECC 2021 (Coming Soon)
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Value Propositions */}
      <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Measurable ROI from Day One
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              ForemanOS pays for itself within the first week. Here&apos;s how teams measure the impact.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Value Prop 1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="bg-white rounded-xl p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow"
            >
              <div className="w-14 h-14 bg-blue-100 rounded-lg flex items-center justify-center mb-6">
                <Clock className="h-7 w-7 text-[#003B71]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Reclaim Your Day</h3>
              <p className="text-gray-600 mb-4">
                Stop flipping through drawing sets. Ask any question about dimensions, specs, or requirements and get a cited answer in seconds -- from the field or the office.
              </p>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm font-semibold text-[#003B71] mb-1">Average Time Savings</p>
                <p className="text-3xl font-bold text-[#003B71]">10+ Hours</p>
                <p className="text-sm text-gray-600">per week per user</p>
              </div>
            </motion.div>

            {/* Value Prop 2 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="bg-white rounded-xl p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow"
            >
              <div className="w-14 h-14 bg-green-100 rounded-lg flex items-center justify-center mb-6">
                <DollarSign className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Prevent Costly Rework</h3>
              <p className="text-gray-600 mb-4">
                Catch MEP clashes, code violations, and missing details before they become change orders. One prevented rework issue can save more than a year of subscription costs.
              </p>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm font-semibold text-green-700 mb-1">Annual Savings</p>
                <p className="text-3xl font-bold text-green-700">$37,500+</p>
                <p className="text-sm text-gray-600">per PM at $75/hr rate</p>
              </div>
            </motion.div>

            {/* Value Prop 3 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
              className="bg-white rounded-xl p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow"
            >
              <div className="w-14 h-14 bg-purple-100 rounded-lg flex items-center justify-center mb-6">
                <Target className="h-7 w-7 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Trust Every Answer</h3>
              <p className="text-gray-600 mb-4">
                Every response cites the exact sheet, page, and section it came from. Your team verifies answers against the source, not against someone&apos;s memory.
              </p>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm font-semibold text-purple-700 mb-1">Accuracy Rate</p>
                <p className="text-3xl font-bold text-purple-700">95%+</p>
                <p className="text-sm text-gray-600">with source citations</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              How ForemanOS Works
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Three simple steps to transform your construction document workflow.
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            <div className="space-y-8">
              {/* Step 1 */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="flex items-start gap-6"
              >
                <div className="w-12 h-12 bg-[#003B71] rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Upload Your Plans</h3>
                  <p className="text-gray-600">
                    Upload construction drawings, specs, schedules, and reports. Our AI automatically extracts title blocks, scales, symbols, 
                    dimensions, grid coordinates, MEP systems, and detail callouts from every sheet.
                  </p>
                </div>
              </motion.div>

              {/* Step 2 */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                viewport={{ once: true }}
                className="flex items-start gap-6"
              >
                <div className="w-12 h-12 bg-[#003B71] rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  2
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">AI Analyzes Everything</h3>
                  <p className="text-gray-600">
                    Our Plan Intelligence Engine correlates grid coordinates across disciplines, traces MEP paths in 3D, detects system clashes, 
                    validates code compliance, and identifies cross-references between sheets—all automatically.
                  </p>
                </div>
              </motion.div>

              {/* Step 3 */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
                className="flex items-start gap-6"
              >
                <div className="w-12 h-12 bg-[#003B71] rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  3
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Get Instant Answers</h3>
                  <p className="text-gray-600">
                    Ask questions in plain English about dimensions, locations, MEP systems, or code requirements. Get accurate answers with 
                    citations from your drawings and building codes—no more manual searching through hundreds of pages.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Who We Serve */}
      <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Built for Every Role on the Jobsite
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From the trailer to the field, ForemanOS gives every team member the information they need, when they need it.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="bg-white rounded-lg p-6 shadow-md border border-gray-200"
            >
              <Users className="h-10 w-10 text-[#003B71] mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Project Managers</h3>
              <p className="text-sm text-gray-600">
                Answer owner questions instantly, track budget variance in real time, and keep every subcontractor aligned on the latest revision.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="bg-white rounded-lg p-6 shadow-md border border-gray-200"
            >
              <Users className="h-10 w-10 text-[#003B71] mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">General Contractors</h3>
              <p className="text-sm text-gray-600">
                Coordinate trades with AI-detected MEP clashes, manage RFIs and submittals, and run multi-project dashboards from one platform.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="bg-white rounded-lg p-6 shadow-md border border-gray-200"
            >
              <Users className="h-10 w-10 text-[#003B71] mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Field Supervisors</h3>
              <p className="text-sm text-gray-600">
                Pull up any dimension, spec, or detail on your phone during walk-throughs. No more calling the office to check a sheet reference.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
              className="bg-white rounded-lg p-6 shadow-md border border-gray-200"
            >
              <Users className="h-10 w-10 text-[#003B71] mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Estimators</h3>
              <p className="text-sm text-gray-600">
                Run AI-powered takeoffs that count symbols, calculate material quantities, and apply waste factors. Export to Excel for your bid package.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Ribbon */}
      <section className="py-20 bg-gradient-to-r from-[#003B71] via-[#004d94] to-[#003B71] relative overflow-hidden">
        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto text-center"
          >
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              Stop Searching. Start Building.
            </h2>
            <p className="text-xl text-white/90 mb-8 leading-relaxed">
              Upload your plans, ask a question, and see what AI-powered plan intelligence can do for your next project. Free plan available -- no credit card, no sales call required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/pricing">
                <Button 
                  size="lg"
                  className="bg-white hover:bg-gray-100 text-[#003B71] px-10 py-7 text-xl font-bold rounded-lg shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-200"
                >
                  View Pricing Plans
                  <ArrowRight className="ml-3 h-6 w-6" />
                </Button>
              </Link>
              <Link href="/signup">
                <Button 
                  size="lg"
                  variant="outline"
                  className="border-2 border-white !text-white !bg-transparent hover:!bg-white/10 hover:!text-white px-10 py-7 text-xl font-bold rounded-lg shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-200"
                >
                  Start Free Trial
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-white/80 text-sm">
              No credit card required • Setup in minutes • Cancel anytime
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
}
