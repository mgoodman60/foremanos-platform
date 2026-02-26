'use client';

import Link from 'next/link';
import { FileText, Search, Users, Shield, Cloud, Zap, BarChart, Ruler, Grid3x3, Network, Lightbulb, Pin, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Features() {
  return (
    <>
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Features Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-headline font-bold text-[var(--color-text-dark)] mb-4">
            Every Detail in Your Plans, Unlocked by AI
          </h2>
          <p className="text-xl text-[var(--color-text-muted)]">
            Dimensions, symbols, MEP routing, code violations, material quantities — extracted and cross-referenced across every sheet in your drawing set.
          </p>
        </div>
        
        {/* Intelligence Features - Phase A, B, C */}
        <div className="mb-16">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h3 className="text-2xl font-headline font-bold text-[var(--color-text-dark)] mb-2">
              🧠 Plan Intelligence Engine
            </h3>
            <p className="text-[var(--color-text-muted)]">
              Three phases of AI analysis turn static PDFs into a searchable, cross-referenced project knowledge base
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
            <div className="card p-8 hover:border-blue-500 transition-colors">
              <Ruler className="h-10 w-10 text-blue-600 mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Title Blocks & Scales</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Never manually log sheet numbers again. AI reads every title block, extracts drawing scales, and validates scale accuracy across your entire plan set.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Upload Plans →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-purple-500 transition-colors">
              <Lightbulb className="h-10 w-10 text-purple-600 mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Symbol Recognition</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Identifies 230+ construction symbols across CSI, ASHRAE, IEEE, and IBC standards — and learns your project-specific custom symbols over time.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                See It in Action →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-green-500 transition-colors">
              <FileText className="h-10 w-10 text-green-600 mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Detail Callouts & Cross-References</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Stop flipping between sheets. AI maps every detail callout into bidirectional links so you jump from a plan reference to its detail in one click.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Try It Free →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-orange-500 transition-colors">
              <Ruler className="h-10 w-10 text-orange-600 mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Dimension Intelligence</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Reads feet-inches, metric, and decimal dimensions from any sheet. Validates dimension chains and flags discrepancies before they reach the field.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Try It Free →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-red-500 transition-colors">
              <Grid3x3 className="h-10 w-10 text-red-600 mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Multi-Sheet Spatial Correlation</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Ask about grid line C-4 and get results from architectural, structural, and MEP sheets together. AI maps coordinates across every discipline in your set.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Try It Free →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-indigo-500 transition-colors">
              <Network className="h-10 w-10 text-indigo-600 mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">MEP Path Tracing & Clash Detection</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Find the duct-to-pipe conflict on paper, not on the jobsite. AI traces M, E, and P systems in 3D, flags hard clashes and clearance violations, and suggests resolutions.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Detect Clashes Now →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-teal-500 transition-colors">
              <Eye className="h-10 w-10 text-teal-600 mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Isometric View Interpretation</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Turn 2D isometric shop drawings into 3D spatial data. AI reconstructs piping and ductwork paths so you can verify routing without a BIM model.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Try It Free →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-pink-500 transition-colors">
              <Pin className="h-10 w-10 text-pink-600 mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Visual Annotations</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Pin notes, RFIs, and markups directly on your drawings. Every annotation tracks priority, status, and owner — so nothing falls through the cracks.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Try It Free →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-amber-500 transition-colors">
              <BarChart className="h-10 w-10 text-amber-600 mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Intelligence Dashboard</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                See your project&apos;s pulse at a glance. Track extraction quality, data completeness, and AI confidence scores — so you know exactly what the system has covered.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                View the Dashboard →
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
              RFIs, submittals, daily reports, budgets, schedules, and field photos — managed in one place, powered by AI
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="card p-8 hover:border-[var(--color-primary)] transition-colors">
              <Search className="h-10 w-10 text-[var(--color-primary)] mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">AI Document Search</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                &quot;What&apos;s the slab thickness at grid B-3?&quot; Ask in plain English, get the answer with the exact sheet and section cited. No more digging through 200-page plan sets.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Ask Your First Question →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-[var(--color-primary)] transition-colors">
              <Shield className="h-10 w-10 text-[var(--color-primary)] mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Code Compliance Checking</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Check your plans against ADA 2010 standards automatically. Flag accessibility violations, parking requirements, and clearance issues before the inspector arrives.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Run a Compliance Check →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-[var(--color-primary)] transition-colors">
              <Zap className="h-10 w-10 text-[var(--color-primary)] mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Quantity Takeoffs</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Extract material quantities directly from your drawings — counts, linear footage, square footage — with waste factors applied. Export to Excel for estimating and procurement.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Run a Takeoff →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-[var(--color-primary)] transition-colors">
              <Users className="h-10 w-10 text-[var(--color-primary)] mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Team Collaboration</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Give your PM full access, your client view-only dashboards, and your subs exactly the documents they need. Role-based permissions keep every project locked down.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Invite Your Team →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-[var(--color-primary)] transition-colors">
              <Cloud className="h-10 w-10 text-[var(--color-primary)] mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">OneDrive Integration</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Connect your OneDrive and every new drawing is automatically processed and searchable. No manual uploads — your project folder stays in sync.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Connect OneDrive →
              </Link>
            </div>
            
            <div className="card p-8 hover:border-[var(--color-primary)] transition-colors">
              <BarChart className="h-10 w-10 text-[var(--color-primary)] mb-4" />
              <h3 className="text-xl font-headline font-semibold mb-3">Schedule & Cost Tracking</h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Import schedules, track earned value, and spot cost variance early. Built-in weather delay analysis shows you exactly how storms are impacting your timeline.
              </p>
              <Link href="/signup" className="text-[var(--color-secondary)] font-medium hover:underline">
                Track Your Project →
              </Link>
            </div>
          </div>
        </div>

        {/* Solutions Section */}
        <div className="bg-[var(--bg-secondary)] -mx-4 sm:-mx-6 px-4 sm:px-6 py-20 mt-20">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-headline font-bold text-[var(--color-text-dark)] mb-4">
              Your Trade. Your Workflows. Your AI.
            </h2>
            <p className="text-xl text-[var(--color-text-muted)]">
              ForemanOS speaks your discipline&apos;s language — whether you&apos;re coordinating 20 subs or pulling wire on the third floor.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Link href="/solutions/general-contractors" className="card p-6 hover:shadow-lg transition-shadow group">
              <h3 className="text-lg font-headline font-semibold mb-2 group-hover:text-[var(--color-primary)]">
                General Contractors
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Coordinate subs, track RFIs, manage change orders, and get instant answers from the latest plan set — all in one place.
              </p>
            </Link>
            
            <Link href="/solutions/construction-managers" className="card p-6 hover:shadow-lg transition-shadow group">
              <h3 className="text-lg font-headline font-semibold mb-2 group-hover:text-[var(--color-primary)]">
                Construction Managers
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Track schedule variance, earned value, and budget burn rate. Daily reports and field photos flow in from every crew automatically.
              </p>
            </Link>
            
            <Link href="/solutions/electrical" className="card p-6 hover:shadow-lg transition-shadow group">
              <h3 className="text-lg font-headline font-semibold mb-2 group-hover:text-[var(--color-primary)]">
                Electrical Contractors
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Pull load schedules, panel specs, and circuit details from E-sheets in seconds. AI traces conduit paths and flags clashes with other trades.
              </p>
            </Link>
            
            <Link href="/solutions/plumbing-hvac" className="card p-6 hover:shadow-lg transition-shadow group">
              <h3 className="text-lg font-headline font-semibold mb-2 group-hover:text-[var(--color-primary)]">
                Plumbing & HVAC
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Get fixture counts, equipment specs, and pipe sizing from M and P sheets. 3D clash detection catches conflicts with electrical and structural before rough-in.
              </p>
            </Link>
            
            <Link href="/solutions/concrete-masons" className="card p-6 hover:shadow-lg transition-shadow group">
              <h3 className="text-lg font-headline font-semibold mb-2 group-hover:text-[var(--color-primary)]">
                Concrete & Masons
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Extract foundation details, rebar schedules, and concrete mix specs from structural drawings. Quantity takeoffs calculate CY and tonnage with waste factors.
              </p>
            </Link>
            
            <Link href="/solutions/site-work" className="card p-6 hover:shadow-lg transition-shadow group">
              <h3 className="text-lg font-headline font-semibold mb-2 group-hover:text-[var(--color-primary)]">
                Site Work Contractors
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Read grading plans, utility layouts, and stormwater details. AI extracts cut/fill quantities, pipe inverts, and setback dimensions from civil sheets.
              </p>
            </Link>
          </div>
        </div>

        {/* Final CTA */}
        <div className="dark-bg -mx-4 sm:-mx-6 px-4 sm:px-6 py-20 mt-20 rounded-xl">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-headline font-bold text-white mb-6">
              Your Plans Have the Answers. Let AI Find Them.
            </h2>
            <p className="text-xl text-[var(--color-text-light)] mb-8">
              Free plan includes 50 queries/month and 1 project. No credit card required. Upgrade when you&apos;re ready.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button className="btn-ribbon text-white font-bold text-lg px-8 py-4 w-full sm:w-auto min-h-[var(--touch-target)] shadow-2xl border-2 border-yellow-300">
                  🎉 Upload Your First Plan — Free
                </Button>
              </Link>
              <Link href="/pricing">
                <Button
                  variant="outline"
                  className="text-lg px-8 py-4 w-full sm:w-auto bg-white/10 border-2 border-white text-white hover:bg-white/20 hover:border-[var(--color-primary)] transition-all min-h-[var(--touch-target)]"
                >
                  Compare Plans — Starting at $15/mo
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
