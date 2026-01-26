'use client';

import Link from 'next/link';
import { FileText, Search, Users, Shield, Cloud, Zap, BarChart, Lock, Brain, Ruler, Grid3x3, Network, Lightbulb, Pin, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Features() {
  return (
    <>
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Features Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-headline font-bold text-[var(--color-text-dark)] mb-4">
            Advanced Intelligence for Construction Plans
          </h2>
          <p className="text-xl text-[var(--color-text-muted)]">
            AI-powered plan analysis that extracts dimensions, symbols, callouts, MEP systems, and code compliance—automatically.
          </p>
        </div>
        
        {/* Intelligence Features - Phase A, B, C */}
        <div className="mb-16">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h3 className="text-2xl font-headline font-bold text-[var(--color-text-dark)] mb-2">
              🧠 Plan Intelligence Engine
            </h3>
            <p className="text-[var(--color-text-muted)]">
              Our AI automatically analyzes your construction drawings to extract critical data
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
            <div className="card p-8 hover:border-blue-500 transition-colors">
              <Ruler className="h-10 w-10 text-blue-600 mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Title Blocks & Scales</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Automatically extracts sheet numbers, drawing scales, and title block metadata. Validates scale accuracy across all plans.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Get Started →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-purple-500 transition-colors">
              <Lightbulb className="h-10 w-10 text-purple-600 mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Symbol Recognition</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Identifies construction symbols against CSI, ASHRAE, IEEE, and IBC standards. AI learns project-specific custom symbols.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Get Started →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-green-500 transition-colors">
              <FileText className="h-10 w-10 text-green-600 mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Detail Callouts & Cross-References</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Extracts detail callouts and creates bidirectional links between sheets. Navigate complex drawing sets instantly.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Get Started →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-orange-500 transition-colors">
              <Ruler className="h-10 w-10 text-orange-600 mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Dimension Intelligence</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Parses feet-inches, metric, and decimal dimensions. Validates dimension chains and performs automatic quantity calculations.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Get Started →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-red-500 transition-colors">
              <Grid3x3 className="h-10 w-10 text-red-600 mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Multi-Sheet Spatial Correlation</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Maps grid coordinates across architectural, structural, and MEP sheets. Find matching locations across all disciplines.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Get Started →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-indigo-500 transition-colors">
              <Network className="h-10 w-10 text-indigo-600 mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">MEP Path Tracing & Clash Detection</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Traces mechanical, electrical, and plumbing systems in 3D. Detects hard clashes, clearance violations, and suggests resolutions.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Get Started →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-teal-500 transition-colors">
              <Eye className="h-10 w-10 text-teal-600 mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Isometric View Interpretation</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Converts 2D isometric drawings into 3D spatial data. Reconstructs piping and ductwork paths from shop drawings.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Get Started →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-pink-500 transition-colors">
              <Pin className="h-10 w-10 text-pink-600 mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Visual Annotations</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Click to pin notes directly on drawings. Track RFIs, issues, and markups with priority levels and status tracking.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Get Started →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-amber-500 transition-colors">
              <BarChart className="h-10 w-10 text-amber-600 mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Intelligence Dashboard</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Real-time system health monitoring with AI-generated insights. Track data quality, integration status, and project metrics.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Get Started →
              </Link>
            </div>
          </div>
        </div>

        {/* Core Platform Features */}
        <div className="mb-16">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h3 className="text-2xl font-headline font-bold text-[var(--color-text-dark)] mb-2">
              📋 Complete Project Management
            </h3>
            <p className="text-[var(--color-text-muted)]">
              Everything you need to manage construction projects efficiently
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="card p-8 hover:border-[var(--color-primary)] transition-colors">
              <Search className="h-10 w-10 text-[var(--color-primary)] mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">AI Document Search</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Ask questions in plain English. Get instant answers with citations from your plans, specs, and schedules.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Get Started →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-[var(--color-primary)] transition-colors">
              <Shield className="h-10 w-10 text-[var(--color-primary)] mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Code Compliance Checking</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Automatic verification against ADA 2010, IBC 2021, and NFPA standards. Catch violations before inspections.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Get Started →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-[var(--color-primary)] transition-colors">
              <Zap className="h-10 w-10 text-[var(--color-primary)] mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Quantity Takeoffs</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Extract room dimensions and material quantities from plans. Export to Excel for estimating and procurement.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Get Started →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-[var(--color-primary)] transition-colors">
              <Users className="h-10 w-10 text-[var(--color-primary)] mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Team Collaboration</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Role-based permissions for admins, clients, and guests. Manage crews, subcontractors, and project access securely.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Get Started →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-[var(--color-primary)] transition-colors">
              <Cloud className="h-10 w-10 text-[var(--color-primary)] mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">OneDrive Integration</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Connect your OneDrive folder for automatic document sync. New files are processed and indexed instantly.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Get Started →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-[var(--color-primary)] transition-colors">
              <BarChart className="h-10 w-10 text-[var(--color-primary)] mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Schedule & Cost Tracking</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Parse MS Project schedules, track progress, and monitor earned value. Weather impact analysis included.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Get Started →
              </Link>
            </div>
          </div>
        </div>

        {/* Solutions Section */}
        <div className="bg-[var(--bg-secondary)] -mx-4 sm:-mx-6 px-4 sm:px-6 py-20 mt-20">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-headline font-bold text-[var(--color-text-dark)] mb-4">
              Built for Construction Teams
            </h2>
            <p className="text-xl text-[var(--color-text-muted)]">
              Whether you're a GC, specialty contractor, or owner's rep.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Link href="/solutions/general-contractors" className="card p-6 hover:shadow-lg transition-shadow group">
              <h3 className="text-lg font-headline font-semibold mb-2 group-hover:text-[var(--color-primary)]">
                General Contractors
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Coordinate trades and keep everyone aligned on documents.
              </p>
            </Link>
            
            <Link href="/solutions/construction-managers" className="card p-6 hover:shadow-lg transition-shadow group">
              <h3 className="text-lg font-headline font-semibold mb-2 group-hover:text-[var(--color-primary)]">
                Construction Managers
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Complete project oversight with instant document access.
              </p>
            </Link>
            
            <Link href="/solutions/electrical" className="card p-6 hover:shadow-lg transition-shadow group">
              <h3 className="text-lg font-headline font-semibold mb-2 group-hover:text-[var(--color-primary)]">
                Electrical Contractors
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Find load schedules, panel specs, and circuit details.
              </p>
            </Link>
            
            <Link href="/solutions/plumbing-hvac" className="card p-6 hover:shadow-lg transition-shadow group">
              <h3 className="text-lg font-headline font-semibold mb-2 group-hover:text-[var(--color-primary)]">
                Plumbing & HVAC
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Quick access to fixture counts and equipment specs.
              </p>
            </Link>
            
            <Link href="/solutions/concrete-masons" className="card p-6 hover:shadow-lg transition-shadow group">
              <h3 className="text-lg font-headline font-semibold mb-2 group-hover:text-[var(--color-primary)]">
                Concrete & Masons
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Quick access to foundation details and rebar schedules.
              </p>
            </Link>
            
            <Link href="/solutions/site-work" className="card p-6 hover:shadow-lg transition-shadow group">
              <h3 className="text-lg font-headline font-semibold mb-2 group-hover:text-[var(--color-primary)]">
                Site Work Contractors
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Instant answers from grading plans and utility layouts.
              </p>
            </Link>
          </div>
        </div>

        {/* Final CTA */}
        <div className="dark-bg -mx-4 sm:-mx-6 px-4 sm:px-6 py-20 mt-20 rounded-xl">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-headline font-bold text-white mb-6">
              Ready to Bring Clarity to Your Projects?
            </h2>
            <p className="text-xl text-[var(--color-text-light)] mb-8">
              Start with our Free plan. Upgrade anytime as your needs grow.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button className="btn-ribbon text-white font-bold text-lg px-8 py-4 w-full sm:w-auto min-h-[var(--touch-target)] shadow-2xl border-2 border-yellow-300">
                  🎉 Get Started Free
                </Button>
              </Link>
              <Link href="/pricing">
                <Button 
                  variant="outline"
                  className="text-lg px-8 py-4 w-full sm:w-auto bg-white/10 border-2 border-white text-white hover:bg-white/20 hover:border-[var(--color-primary)] transition-all min-h-[var(--touch-target)]"
                >
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}
