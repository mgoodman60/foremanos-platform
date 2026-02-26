import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Play, MessageSquare, FolderOpen, Cloud, Shield, Users, FileCheck, Smartphone, Brain, Ruler, Grid3x3, Network, Lightbulb, Pin, Eye, BarChart } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: 'Features | ForemanOS',
  description: 'AI-powered document intelligence for construction teams. Instant answers from plans, specs, and project documents.',
};

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Header */}
      <LandingHeader />
      
      {/* Hero */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            Upload Plans. Ask Questions. Get Cited Answers.
          </h1>
          <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto">
            ForemanOS reads construction drawings the way your best PM would -- extracting dimensions, tracing MEP systems, checking code compliance, and answering questions with exact sheet references. Here&apos;s how it works.
          </p>
        </div>
      </section>

      {/* Plan Intelligence Engine Overview */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-blue-950/30 to-gray-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-6">
              <Brain className="w-8 h-8" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Plan Intelligence Engine
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              While traditional OCR just reads text, our Plan Intelligence Engine understands construction drawings -- extracting structured data from title blocks, dimensions, symbols, and MEP layouts automatically.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-gray-800/50 rounded-lg p-6 border border-blue-700/30">
              <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
                <Ruler className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Title Blocks & Scales</h3>
              <p className="text-gray-300 text-sm">
                Reads sheet numbers, drawing scales, and title block data from every page. Flags scale inconsistencies across sheets so your takeoff quantities stay accurate.
              </p>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-6 border border-purple-700/30">
              <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center mb-4">
                <Lightbulb className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Symbol Recognition</h3>
              <p className="text-gray-300 text-sm">
                Identifies 230+ construction symbols across CSI, ASHRAE, IEEE, and IBC standards. The AI learns your project&apos;s custom symbols and improves with every drawing set.
              </p>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-6 border border-green-700/30">
              <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center mb-4">
                <FileCheck className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Detail Callouts & Cross-References</h3>
              <p className="text-gray-300 text-sm">
                Maps every detail callout to its source sheet with bidirectional links. Ask about Detail 3/A-401 and get taken straight to the referenced section.
              </p>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-6 border border-orange-700/30">
              <div className="w-12 h-12 bg-orange-600/20 rounded-lg flex items-center justify-center mb-4">
                <Ruler className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Dimension Intelligence</h3>
              <p className="text-gray-300 text-sm">
                Parses feet-inches, metric, and decimal dimensions from any drawing convention. Validates dimension chains for consistency and feeds directly into takeoff calculations.
              </p>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-6 border border-red-700/30">
              <div className="w-12 h-12 bg-red-600/20 rounded-lg flex items-center justify-center mb-4">
                <Grid3x3 className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Spatial Correlation</h3>
              <p className="text-gray-300 text-sm">
                Ask &quot;What&apos;s at Grid B-3?&quot; and get results from architectural, structural, and MEP sheets simultaneously. Grid coordinates are mapped across every discipline in the set.
              </p>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-6 border border-indigo-700/30">
              <div className="w-12 h-12 bg-indigo-600/20 rounded-lg flex items-center justify-center mb-4">
                <Network className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">MEP Path Tracing</h3>
              <p className="text-gray-300 text-sm">
                Traces ductwork, piping, and conduit in 3D across all MEP sheets. Detects hard clashes and clearance violations between trades, with suggested reroutes.
              </p>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl p-8 border border-blue-700/30">
            <h3 className="text-2xl font-bold mb-4 text-blue-400">This Is Not Just OCR</h3>
            <div className="grid md:grid-cols-2 gap-6 text-gray-300">
              <div>
                <p className="mb-3">
                  <strong className="text-white">Traditional OCR</strong> reads text character-by-character. It has no idea that &quot;3/A-401&quot; is a detail callout, that the 12&quot; label refers to duct size, or that Sheet M-101 and Sheet S-101 share the same grid system.
                </p>
                <p>
                  <strong className="text-white">ForemanOS Plan Intelligence</strong> uses computer vision trained on construction documents. It understands drawing conventions, interprets spatial relationships between disciplines, and builds a structured data model of your entire drawing set.
                </p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-6">
                <p className="text-sm font-semibold text-blue-400 mb-2">Real Example:</p>
                <p className="text-sm">
                  From a 45-sheet MEP drawing set, ForemanOS automatically extracted:
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  <li>• <strong>127</strong> duct runs with sizes</li>
                  <li>• <strong>89</strong> equipment tags and locations</li>
                  <li>• <strong>14</strong> detected clashes between trades</li>
                  <li>• <strong>243</strong> grid coordinate mappings</li>
                  <li>• All in under <strong>3 minutes</strong></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Document Chat */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-4 mb-8">
            <MessageSquare className="w-12 h-12 text-[#F97316]" />
            <h2 className="text-3xl sm:text-4xl font-bold">AI Document Chat</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-[#F97316]">Your Entire Drawing Set, Searchable by Question</h3>
              <p className="text-gray-300 mb-4">
                Type a question in plain English and get an answer pulled from your plans, specs, and submittals -- with the exact sheet number and section cited. No more flipping through 200 pages to find one dimension.
              </p>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start gap-3">
                  <span className="text-[#F97316] font-bold">•</span>
                  <span><strong>Natural Language Search:</strong> &quot;What&apos;s the parking space requirement?&quot; or &quot;Show me the rebar spacing for footing F-1&quot;</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#F97316] font-bold">•</span>
                  <span><strong>Source Citations:</strong> Every answer includes sheet numbers and document references so you can verify the information</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#F97316] font-bold">•</span>
                  <span><strong>Context-Aware:</strong> The AI understands construction terminology, dimensions, and technical specs</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#F97316] font-bold">•</span>
                  <span><strong>Conversation History:</strong> Keep track of all your questions and answers for easy reference</span>
                </li>
              </ul>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <h4 className="text-lg font-semibold mb-4 text-[#F97316]">Example Questions</h4>
              <div className="space-y-4">
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">User asks:</p>
                  <p className="text-white">&quot;What&apos;s the parking space requirement for this project?&quot;</p>
                </div>
                <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700/30">
                  <p className="text-sm text-gray-400 mb-1">ForemanOS responds:</p>
                  <p className="text-gray-300">The project requires <strong>45 parking spaces</strong> (30 standard + 15 compact) per Sheet A-101, Section 3.2.</p>
                  <p className="text-xs text-blue-400 mt-2">Source: Site Survey.pdf, Page 12</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MEP Clash Detection & 3D Analysis */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-4 mb-8">
            <Network className="w-12 h-12 text-[#F97316]" />
            <h2 className="text-3xl sm:text-4xl font-bold">MEP Clash Detection & 3D Path Tracing</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-[#F97316]">Find Coordination Issues on Screen, Not in the Ceiling</h3>
              <p className="text-gray-300 mb-4">
                ForemanOS traces HVAC, plumbing, and electrical systems in 3D from your MEP drawings and flags conflicts between trades. Hard clashes, clearance violations, and routing conflicts surface during preconstruction -- not during rough-in.
              </p>
              <div className="space-y-4">
                <div className="bg-red-900/20 rounded-lg p-4 border border-red-700/30">
                  <h4 className="font-semibold text-red-400 mb-2">🔴 Hard Clash</h4>
                  <p className="text-sm text-gray-300">Physical interference detected: 12&quot; duct intersects with structural beam at Grid B-3, Level 2. Both elements occupy the same space.</p>
                </div>
                <div className="bg-orange-900/20 rounded-lg p-4 border border-orange-700/30">
                  <h4 className="font-semibold text-orange-400 mb-2">🟠 Clearance Violation</h4>
                  <p className="text-sm text-gray-300">Minimum clearance not met: Sprinkler head requires 18&quot; from ceiling, only 12&quot; available. Code compliance risk.</p>
                </div>
                <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700/30">
                  <h4 className="font-semibold text-blue-400 mb-2">💡 Resolution Suggested</h4>
                  <p className="text-sm text-gray-300">Route duct 6&quot; north to avoid beam. Clearance check passed with reroute. Coordination drawing auto-generated.</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <h4 className="text-xl font-semibold mb-4">What Gets Analyzed</h4>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start gap-3">
                  <span className="text-green-500">✓</span>
                  <span><strong>Duct Runs:</strong> Traces HVAC ductwork with sizes, elevations, and routing paths</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500">✓</span>
                  <span><strong>Piping Systems:</strong> Maps domestic water, waste, fire protection with material types</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500">✓</span>
                  <span><strong>Conduit & Cable Trays:</strong> Identifies electrical pathways and panel locations</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500">✓</span>
                  <span><strong>Structural Elements:</strong> Detects beams, columns, and walls for clearance checks</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500">✓</span>
                  <span><strong>Vertical Risers:</strong> Traces multi-floor connections and shaft penetrations</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500">✓</span>
                  <span><strong>Equipment:</strong> Maps mechanical units, panels, fixtures with tag numbers</span>
                </li>
              </ul>
              <div className="mt-6 bg-blue-900/20 rounded-lg p-4 border border-blue-700/30">
                <p className="text-sm font-semibold text-blue-400 mb-2">System Health Score:</p>
                <p className="text-gray-300 text-sm">Analyzes overall coordination quality across all trades. Provides actionable metrics on clash count, severity distribution, and resolution progress.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Intelligence Features */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Beyond Document Search
            </h2>
            <p className="text-xl text-gray-300">
              ForemanOS doesn&apos;t just find information -- it interprets drawings, manages collaboration, and tracks project health
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <Eye className="w-8 h-8 text-teal-400" />
                <h3 className="text-xl font-semibold">Isometric View Interpretation</h3>
              </div>
              <p className="text-gray-300 mb-4">
                Reads 2D isometric shop drawings and reconstructs 3D spatial data. The AI understands projection angles, elevation relationships, and routing paths from MEP isometrics that would take an engineer hours to trace manually.
              </p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Detects isometric projection angles (30-60°, 45-45°, custom)</li>
                <li>• Reconstructs 3D coordinates from 2D views</li>
                <li>• Identifies vertical vs horizontal routing</li>
                <li>• Understands fittings, valves, and connections</li>
              </ul>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <Pin className="w-8 h-8 text-pink-400" />
                <h3 className="text-xl font-semibold">Visual Annotations</h3>
              </div>
              <p className="text-gray-300 mb-4">
                Pin notes, RFIs, and markups directly on drawings at exact coordinates. Assign to team members, track status from open to resolved, and keep a full thread of replies tied to the exact location on the sheet.
              </p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Pin annotations at exact x/y coordinates or grid locations</li>
                <li>• Categorize by type: RFI, Issue, Markup, Approval</li>
                <li>• Assign to team members with priority levels</li>
                <li>• Track status from open → in progress → resolved → closed</li>
              </ul>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <Grid3x3 className="w-8 h-8 text-red-400" />
                <h3 className="text-xl font-semibold">Multi-Sheet Grid Correlation</h3>
              </div>
              <p className="text-gray-300 mb-4">
                Automatically maps grid coordinate systems across architectural, structural, and MEP disciplines. Find the same location on any sheet instantly.
              </p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Parses grid formats: &quot;A-3&quot;, &quot;B/12&quot;, &quot;Grid A-3&quot;</li>
                <li>• Cross-references between discipline sheets</li>
                <li>• Calculates grid distances and adjacency</li>
                <li>• Identifies overlapping zones between sheets</li>
              </ul>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <BarChart className="w-8 h-8 text-amber-400" />
                <h3 className="text-xl font-semibold">Intelligence Dashboard</h3>
              </div>
              <p className="text-gray-300 mb-4">
                A single view of your project&apos;s data quality, extraction completeness, and coordination status. AI-generated insights flag missing information and recommend actions before they become issues.
              </p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Overall intelligence score with health status indicators</li>
                <li>• Phase-by-phase metrics (Foundation, Advanced, Integration)</li>
                <li>• AI-generated insights about project state</li>
                <li>• Actionable recommendations for data quality improvement</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Project Organization */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-4 mb-8">
            <FolderOpen className="w-12 h-12 text-[#F97316]" />
            <h2 className="text-3xl sm:text-4xl font-bold">Multi-Project Organization</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <h3 className="text-xl font-semibold mb-3">Project Workspaces</h3>
              <p className="text-gray-300">
                Every job gets its own workspace with separate document libraries, conversation histories, and team access. Running five jobs? Switch between them instantly without mixing up drawings.
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <h3 className="text-xl font-semibold mb-3">Document Library</h3>
              <p className="text-gray-300">
                Upload plans, specs, schedules, RFIs, submittals -- any PDF or Word doc. The AI indexes everything so you can search across all documents or drill into a single sheet.
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <h3 className="text-xl font-semibold mb-3">Activity Tracking</h3>
              <p className="text-gray-300">
                See who uploaded what, when questions were asked, and which documents are most referenced. Complete audit trail for every project.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* OneDrive Integration */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-4 mb-8">
            <Cloud className="w-12 h-12 text-[#F97316]" />
            <h2 className="text-3xl sm:text-4xl font-bold">OneDrive Sync Integration</h2>
          </div>
          <div className="max-w-4xl mx-auto">
            <p className="text-xl text-gray-300 text-center mb-8">
              Point ForemanOS at your OneDrive folder and every new document syncs automatically. When the architect issues a revision, your team sees it in ForemanOS within minutes -- no manual uploads.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-semibold mb-3 text-[#F97316]">How It Works</h3>
                <ol className="space-y-2 text-gray-300">
                  <li>1. Connect your OneDrive folder to a project</li>
                  <li>2. ForemanOS monitors for new files</li>
                  <li>3. New documents auto-process with OCR/vision</li>
                  <li>4. Searchable content appears in minutes</li>
                </ol>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-semibold mb-3 text-[#F97316]">Benefits</h3>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    <span>One source of truth for all stakeholders</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    <span>No version control issues</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Field crews always have latest plans</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Regulatory Code Library */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-4 mb-8">
            <FileCheck className="w-12 h-12 text-[#F97316]" />
            <h2 className="text-3xl sm:text-4xl font-bold">Built-In Regulatory Code Library</h2>
          </div>
          <div className="max-w-4xl mx-auto">
            <p className="text-xl text-gray-300 text-center mb-8">
              Building codes are built into ForemanOS. Ask about parking requirements, corridor widths, or fire separation distances and get the exact code section, calculation, and compliance status -- no separate code lookup needed.
            </p>
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700 text-center">
                <h3 className="text-2xl font-bold text-[#F97316] mb-2">IBC 2021</h3>
                <p className="text-gray-400">International Building Code</p>
                <p className="text-sm text-gray-500 mt-2">833 pages • Fully searchable</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700 text-center">
                <h3 className="text-2xl font-bold text-[#F97316] mb-2">ADA 2010</h3>
                <p className="text-gray-400">Accessibility Standards</p>
                <p className="text-sm text-gray-500 mt-2">279 pages • With diagrams</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700 text-center">
                <h3 className="text-2xl font-bold text-[#F97316] mb-2">NFPA 101</h3>
                <p className="text-gray-400">Life Safety Code</p>
                <p className="text-sm text-gray-500 mt-2">505 pages • Fire/egress</p>
              </div>
            </div>
            <div className="bg-blue-900/20 rounded-lg p-6 border border-blue-700/30">
              <h4 className="text-lg font-semibold mb-3 text-blue-400">Example Code Query</h4>
              <p className="text-gray-400 text-sm mb-2">User asks:</p>
              <p className="text-white mb-4">&quot;What&apos;s the IBC requirement for corridor width in assembly occupancy?&quot;</p>
              <p className="text-gray-400 text-sm mb-2">ForemanOS responds:</p>
              <p className="text-gray-300">Per IBC 2021 Section 1020.2, corridors serving an occupant load of 50 or more shall be not less than 44 inches in width. <span className="text-blue-400 text-sm">[IBC 2021, Section 1020.2]</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* Role-Based Access Control */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-4 mb-8">
            <Shield className="w-12 h-12 text-[#F97316]" />
            <h2 className="text-3xl sm:text-4xl font-bold">Role-Based Access Control</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-purple-900/20 rounded-lg p-6 border border-purple-700/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold">Admin</h3>
              </div>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li>• Full project control</li>
                <li>• Manage team members</li>
                <li>• Set document visibility</li>
                <li>• Access all documents</li>
                <li>• Activity audit logs</li>
              </ul>
            </div>
            <div className="bg-blue-900/20 rounded-lg p-6 border border-blue-700/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold">Client</h3>
              </div>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li>• View assigned projects</li>
                <li>• Access client documents</li>
                <li>• Ask questions via chat</li>
                <li>• Upload documents</li>
                <li>• Limited admin docs</li>
              </ul>
            </div>
            <div className="bg-green-900/20 rounded-lg p-6 border border-green-700/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold">Guest</h3>
              </div>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li>• View public documents only</li>
                <li>• Read-only access</li>
                <li>• Perfect for field crews</li>
                <li>• Mobile-friendly</li>
                <li>• No upload permissions</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h3 className="text-xl font-semibold mb-3 text-[#F97316]">Document-Level Control</h3>
            <p className="text-gray-300">
              Set visibility for each document individually. Share sensitive budget docs with owners only, structural plans with all trades, or safety protocols with everyone on site. Complete flexibility for your workflow.
            </p>
          </div>
        </div>
      </section>

      {/* Team Collaboration */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-4 mb-8">
            <Users className="w-12 h-12 text-[#F97316]" />
            <h2 className="text-3xl sm:text-4xl font-bold">Team Collaboration</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-[#F97316]">Everyone on the Same Page -- Literally</h3>
              <p className="text-gray-300 mb-4">
                Invite owners, architects, engineers, subs, and field crews to your projects. Role-based access ensures everyone sees exactly what they need, and no one works off outdated plans.
              </p>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start gap-3">
                  <span className="text-[#F97316] font-bold">•</span>
                  <span><strong>Email Invitations:</strong> Send project invites with custom access levels</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#F97316] font-bold">•</span>
                  <span><strong>Real-Time Updates:</strong> New documents appear instantly for all team members</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#F97316] font-bold">•</span>
                  <span><strong>Activity Feed:</strong> See who&apos;s viewing what and when questions are asked</span>
                </li>
              </ul>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
              <h4 className="text-lg font-semibold mb-4 text-[#F97316]">Mobile Access</h4>
              <p className="text-gray-300 mb-4">
                Field crews pull up any document on their phone during inspections or walk-throughs. When the owner asks about a detail, the answer is 10 seconds away -- not a phone call.
              </p>
              <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700/30">
                <p className="text-gray-300 text-sm">
                  <strong className="text-blue-400">Real Scenario:</strong> Superintendent on site gets a question about electrical panel location. Opens ForemanOS on phone, asks &quot;Where is panel EP-3?&quot;, gets answer with sheet reference in 5 seconds. Owner impressed, no delay.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">Enterprise-Grade Security</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700 text-center">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2">Encryption</h3>
              <p className="text-gray-400 text-sm">AES-256 at rest, TLS 1.3 in transit</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700 text-center">
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                <FileCheck className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2">Daily Backups</h3>
              <p className="text-gray-400 text-sm">30-day retention with point-in-time recovery</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700 text-center">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2">Audit Logs</h3>
              <p className="text-gray-400 text-sm">Complete activity tracking for compliance</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700 text-center">
              <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2">SOC 2</h3>
              <p className="text-gray-400 text-sm">Type II certified for enterprise security</p>
            </div>
          </div>
        </div>
      </section>

      {/* Video Tour */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-dark-surface">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#F97316] rounded-xl mb-6">
              <Play className="w-8 h-8" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              See ForemanOS in Action
            </h2>
            <p className="text-xl text-gray-300">
              Watch a 90-second overview of how ForemanOS works
            </p>
          </div>

          {/* Video Container */}
          <div className="relative w-full bg-gray-900 rounded-lg border border-gray-700 overflow-hidden mb-12" style={{ paddingBottom: '56.25%' }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <video
                controls
                preload="metadata"
                className="absolute inset-0 w-full h-full"
                poster="/foremanos-new-logo.png"
              >
                <source src="/foremanos-tour.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#F97316] to-[#EA580C]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Try It on Your Own Plans
          </h2>
          <p className="text-xl text-orange-100 mb-8">
            Upload a drawing set, ask a question, and see the Plan Intelligence Engine work on your actual project documents. Free plan available -- no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-[#F97316] rounded-lg font-semibold hover:bg-gray-100 transition-all text-lg min-h-[56px]"
            >
              Upload Your First Plans Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center px-8 py-4 bg-dark-surface text-white rounded-lg font-semibold hover:bg-black transition-all text-lg border-2 border-white/20 min-h-[56px]"
            >
              Request a Live Walkthrough
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
