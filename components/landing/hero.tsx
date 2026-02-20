'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, Shield, MessageSquare, Send, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Hero() {
  const [showTyping, setShowTyping] = useState(false);
  const [showResponse, setShowResponse] = useState(false);

  useEffect(() => {
    const typingTimer = setTimeout(() => setShowTyping(true), 1000);
    const responseTimer = setTimeout(() => setShowResponse(true), 3000);
    
    return () => {
      clearTimeout(typingTimer);
      clearTimeout(responseTimer);
    };
  }, []);

  return (
    <>
    <section className="relative overflow-hidden">
      {/* Hero Background */}
      <div className="dark-bg py-16 lg:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
            
            {/* Left Column - Content */}
            <div className="text-center lg:text-left">
              {/* Brand Headline - Logo removed to avoid duplication with header */}
              
              {/* Headline */}
              <h1 className="text-white text-3xl md:text-4xl lg:text-5xl font-headline font-bold mb-6 text-balance">
                Stop Searching Plans.
                <br />
                <span className="gradient-text">Start Getting Answers.</span>
              </h1>
              
              {/* Subheadline */}
              <p className="text-lg md:text-xl text-[var(--color-text-light)] mb-8 text-balance">
                Upload your drawings. Ask any question. Get cited answers in under 5 seconds—dimensions, MEP clashes, code violations, and material quantities pulled straight from your plans.
              </p>
              
              {/* Key Benefits */}
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
                  <p className="text-[var(--color-text-light)] text-left">
                    <strong className="text-white">Plan Intelligence Engine</strong> — auto-extracts title blocks, scales, symbols, dimensions, and cross-references from every sheet
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
                  <p className="text-[var(--color-text-light)] text-left">
                    <strong className="text-white">MEP clash detection</strong> — 3D path tracing finds conflicts across mechanical, electrical, and plumbing before they cost you in the field
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
                  <p className="text-[var(--color-text-light)] text-left">
                    <strong className="text-white">Code compliance checking</strong> — catch ADA, IBC, and NFPA violations before the inspector does
                  </p>
                </div>
              </div>
              
              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/demo">
                  <Button className="btn-ribbon text-white font-bold text-lg px-8 py-4 w-full sm:w-auto min-h-[var(--touch-target)] shadow-2xl border-2 border-yellow-300">
                    ✨ Analyze Your First Plan — Free
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button 
                    variant="outline"
                    className="text-lg px-8 py-4 w-full sm:w-auto bg-white/10 border-2 border-white text-white hover:bg-white/20 hover:border-[var(--color-primary)] transition-all min-h-[var(--touch-target)]"
                  >
                    See Plans — Starting at $15/mo
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Column - Interactive Chat Demo */}
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md mx-auto lg:mx-0">
                {/* Chat Header */}
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="bg-[var(--color-primary)] p-2 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--color-text-dark)]">Project Assistant</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">Answers from your plans, instantly</p>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="space-y-4 mb-6 min-h-[300px]">
                  {/* User Message */}
                  <div className="flex justify-end">
                    <div className="bg-[var(--color-primary)] text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-[80%]">
                      <p className="text-sm">What's the ADA parking requirement for this site?</p>
                    </div>
                  </div>

                  {/* Typing Indicator */}
                  {showTyping && !showResponse && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Response with Code Citation */}
                  {showResponse && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%]">
                        <p className="text-sm text-[var(--color-text-dark)] mb-2">
                          Per <strong>ADA 2010 Section 208.2</strong>: 1 accessible space per 25 spaces (first 25). Your plans show <strong>120 spaces</strong>, requiring <strong>5 accessible spaces</strong> minimum.
                        </p>
                        <div className="space-y-1 mt-2 pt-2 border-t border-gray-200">
                          <div className="flex items-center gap-2">
                            <Shield className="h-3 w-3 text-green-600" />
                            <p className="text-xs text-green-700 font-semibold">✓ Compliant (5 ADA spaces shown)</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText className="h-3 w-3 text-[var(--color-primary)]" />
                            <p className="text-xs text-[var(--color-text-muted)]">Sources: ADA 2010 Standards, Site Plan A-1.2</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                  <input
                    type="text"
                    placeholder="Ask about your project..."
                    className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--color-text-dark)] placeholder:text-[var(--color-text-muted)]"
                    disabled
                  />
                  <button className="bg-[var(--color-primary)] p-2 rounded-lg hover:bg-orange-600 transition-colors">
                    <Send className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Floating Feature Cards */}
              <div className="hidden lg:block absolute -right-8 -top-4 bg-white rounded-lg shadow-lg p-3 max-w-[180px] animate-float">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-[var(--color-primary)]" />
                  <p className="text-xs font-semibold text-[var(--color-text-dark)]">Secure Access</p>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">Role-based permissions</p>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="bg-[var(--bg-secondary)] py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-headline font-bold text-[var(--color-text-dark)] mb-4">
              From Upload to Answers in 60 Seconds
            </h2>
            <p className="text-xl text-[var(--color-text-muted)]">
              No training. No setup calls. Upload your plans and start asking questions.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="bg-[var(--color-primary)] text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-headline font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-2xl font-headline font-semibold mb-3">Upload Your Drawings</h3>
              <p className="text-[var(--color-text-muted)]">
                Drop in PDFs, CAD files, specs, or schedules. AI instantly reads every sheet — extracting dimensions, symbols, scales, and MEP routing.
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-[var(--color-primary)] text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-headline font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-2xl font-headline font-semibold mb-3">AI Maps Your Entire Project</h3>
              <p className="text-[var(--color-text-muted)]">
                The Plan Intelligence Engine cross-references sheets, traces MEP paths in 3D, detects clashes, and checks code compliance — automatically.
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-[var(--color-primary)] text-white w-16 h-16 rounded-full flex items-center justify-center text-2xl font-headline font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-2xl font-headline font-semibold mb-3">Ask Anything, Get Citations</h3>
              <p className="text-[var(--color-text-muted)]">
                Ask in plain English. Get accurate answers with exact page and section citations — from your drawings, specs, and code standards.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Social Proof Stats */}
      <div className="bg-white py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-headline font-bold text-center text-[var(--color-text-dark)] mb-12">
              Built for the Way Construction Teams Actually Work
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-headline font-bold text-[var(--color-primary)] mb-2">&lt; 5 sec</div>
                <div className="text-[var(--color-text-muted)]">Average answer time — with citations</div>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-headline font-bold text-[var(--color-primary)] mb-2">112</div>
                <div className="text-[var(--color-text-muted)]">Data models purpose-built for construction</div>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-headline font-bold text-[var(--color-primary)] mb-2">$15/mo</div>
                <div className="text-[var(--color-text-muted)]">Starter plan — a fraction of Procore or Fieldwire</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}