# ForemanOS AI Agent Reference Guide

**Version:** February 2026
**Platform:** ForemanOS - AI-Powered Construction Project Management

ForemanOS includes 22 specialized AI agents that automate and assist with construction project management tasks. Each agent is purpose-built for a specific domain, ensuring accurate results whether you are managing budgets, reviewing documents, or coordinating field operations.

---

## How Agents Work

Agents are intelligent assistants built into ForemanOS. You interact with them using natural language -- just describe what you need, and the system automatically selects the right agent. You can also request a specific agent by name or use slash commands.

**Three ways to use agents:**

1. **Natural Language:** "Run a security audit on the project" (auto-selects the security agent)
2. **By Name:** "Use the quantity-surveyor agent to extract quantities"
3. **Slash Commands:** `/test`, `/review`, `/build`, `/check`, `/commit`

---

## Agent Catalog

### Development & Platform Agents (7)

These agents help build, test, and maintain the ForemanOS platform itself.

| Agent | What It Does | When to Use It |
|-------|-------------|----------------|
| **Testing Specialist** | Runs automated tests, generates new tests, improves test coverage | After making code changes, before deploying, or when checking for regressions |
| **Bug Fixer** | Diagnoses and fixes bugs, resolves build errors, updates dependencies | When something is broken, build fails, or errors appear in logs |
| **Security Specialist** | Scans for vulnerabilities (OWASP Top 10), audits authentication, checks for injection attacks | Before releases, during security reviews, or when adding new API endpoints |
| **Documentation Specialist** | Generates code documentation, API docs, and feature guides | When new features need documentation or existing docs are outdated |
| **Database Specialist** | Manages the database schema (112 models), creates migrations, optimizes queries | When adding new data models, fixing slow queries, or migrating the database |
| **UI Specialist** | Creates and modifies user interface components, implements design system | When building new screens, fixing layout issues, or updating the design |
| **UX Design Specialist** | Conducts user research, accessibility audits (WCAG 2.1), and designs user flows | When planning new features, evaluating usability, or ensuring accessibility compliance |

---

### Infrastructure & Specialized Agents (6)

These agents handle deployment, payments, document processing, and system reliability.

| Agent | What It Does | When to Use It |
|-------|-------------|----------------|
| **Infrastructure Specialist** | Manages Vercel deployments, optimizes performance, handles DevOps tasks | When deploying, fixing performance issues, or configuring environments |
| **Stripe Payment Specialist** | Configures subscriptions (6 tiers), handles payments, manages billing | When setting up pricing, debugging payment issues, or adding billing features |
| **PDF Processing Specialist** | Extracts data from PDFs, processes construction drawings, fills form templates | When uploading documents, extracting drawing data, or generating filled forms |
| **Refactoring Specialist** | Restructures code for better organization, reduces duplication | When code needs cleanup, patterns need consolidation, or architecture needs updating |
| **Resilience Architect** | Implements error handling, retry strategies, and system fault tolerance | When improving system reliability, adding fallback mechanisms, or standardizing error handling |
| **Analytics & Reports Specialist** | Generates 7 report types, calculates project metrics (EVM), creates dashboards | When producing executive summaries, cost reports, schedule analysis, or KPI dashboards |

---

### Construction Domain Agents (9)

These are the core agents for construction project management -- purpose-built for industry workflows.

#### Project Controls
Tracks budgets, analyzes schedule health, calculates Earned Value Management (EVM) metrics, forecasts cash flow, and generates look-ahead schedules. Use this when you need to understand project financial and schedule performance.

**Example uses:**
- "What is the current schedule variance?"
- "Generate a 3-week look-ahead schedule"
- "Calculate the project's Cost Performance Index"

---

#### Quantity Surveyor
Extracts quantities from construction drawings (count, linear, area, volume, weight), applies pricing, compares contractor bids, and generates cost estimates. Use this when performing takeoffs or analyzing bids.

**Example uses:**
- "Extract quantities from the floor plan"
- "Compare these two contractor bids"
- "Generate a cost estimate for the electrical scope"

---

#### Document Intelligence
Searches project documents using AI-powered retrieval (RAG) with a 1,000+ point scoring system, extracts data from contracts, classifies uploaded documents, and performs OCR text extraction. Use this when you need to find or analyze information across project documents.

**Example uses:**
- "Find the fire rating requirements in the specs"
- "Extract key terms from the general contractor agreement"
- "Classify the 50 documents just uploaded"

---

#### Field Operations
Generates daily construction reports (weather, labor, equipment, work performed), tracks field progress against milestones, monitors labor hours by trade, and documents weather impacts and delays. Use this for day-to-day field documentation.

**Example uses:**
- "Generate today's daily report"
- "Summarize this week's weather delays"
- "Track labor hours by trade for the month"

---

#### Data Synchronization
Orchestrates data flow between all modules -- when a new invoice arrives, it updates the budget; when weather causes a delay, it updates the schedule. Handles cascade updates and ensures data consistency across the entire platform.

**Example uses:**
- "Sync the budget after new invoices were entered"
- "Update the schedule with the latest weather delays"
- "Check data consistency across all modules"

---

#### Submittal Tracker
Tracks submittals through their approval workflow (Approved, As Noted, Revise, Rejected, Info Only), manages RFI (Request for Information) workflows with priority levels, and verifies specification compliance. Use this when managing the submittal and RFI process.

**Example uses:**
- "List all pending submittals"
- "What is the average RFI response time?"
- "Check spec compliance for the MEP submittals"

---

#### Compliance Checker
Tracks permit status and renewal deadlines, schedules inspections (structural, MEP, fire/life safety), monitors OSHA compliance (fall protection, scaffolding, electrical), manages punchlist items, and coordinates project closeout documentation.

**Example uses:**
- "Which permits are expiring this month?"
- "List all outstanding OSHA compliance items"
- "Generate the project closeout checklist"

---

#### BIM Specialist
Extracts data from Building Information Models (RVT, DWG, IFC, NWD/NWC formats), runs clash detection (hard clashes, clearance issues, workflow conflicts), generates schedules from models (door, window, equipment), and extracts quantities from BIM data.

**Example uses:**
- "Run clash detection on the latest model upload"
- "Extract the door schedule from the BIM"
- "Check for MEP coordination issues between trades"

---

#### Photo Analyst
Analyzes field photos to detect construction progress (percent complete, work installed), identify safety violations, document site conditions, and compare before/after photos. Uses Vision AI for intelligent image understanding.

**Example uses:**
- "Analyze these site photos for safety violations"
- "Estimate construction progress from the latest photos"
- "Compare before and after photos for the lobby area"

---

## How Agents Work Together

ForemanOS agents are designed to collaborate. When one agent extracts data, others can use that data downstream:

```
                   Documents Uploaded
                         |
                         v
              Document Intelligence
              (extracts & classifies)
                    /          \
                   v            v
         Quantity Surveyor   Project Controls
         (takeoffs & bids)   (budget & schedule)
                    \          /
                     v        v
               Field Operations
               (daily reports & progress)
                         |
                         v
                    Data Sync
              (orchestrates everything)
                    /          \
                   v            v
            BIM Specialist   Photo Analyst
            (model data)     (visual checks)
                    \          /
                     v        v
          Compliance Checker & Submittal Tracker
          (permits, inspections, approvals)
```

---

## Claude Opus 4.6 Upgrade (February 2026)

ForemanOS has been upgraded to leverage **Claude Opus 4.6**, the most capable AI model from Anthropic, for high-value tasks. This upgrade improves accuracy and reasoning quality in key areas:

### What Changed

| Area | Improvement | Impact |
|------|-------------|--------|
| **Contract Analysis** | Opus 4.6 provides superior reasoning for complex legal documents | More accurate extraction of obligations, deadlines, and penalty clauses |
| **Budget Extraction** | Upgraded to Opus 4.6 for parsing complex cost breakdowns | Better understanding of nested hierarchies and financial relationships |
| **Construction Drawing Analysis** | Opus 4.6 available as a vision provider | More precise interpretation of floor plans, MEP layouts, and structural details |
| **Premium Chat Responses** | Opus 4.6 available for Business and Enterprise subscribers | More nuanced, accurate answers for complex multi-document reasoning |

### Tiered Model Access

| Subscription Tier | Models Available |
|-------------------|-----------------|
| Free | GPT-3.5 Turbo |
| Starter | GPT-3.5 Turbo, Claude Sonnet 4.5 |
| Pro | GPT-3.5 Turbo, Claude Sonnet 4.5, GPT-4o |
| Team | GPT-3.5 Turbo, Claude Sonnet 4.5, GPT-4o |
| Business | GPT-3.5 Turbo, Claude Sonnet 4.5, GPT-4o, **Claude Opus 4.6** |
| Enterprise | GPT-3.5 Turbo, Claude Sonnet 4.5, GPT-4o, **Claude Opus 4.6** |

### Cost Efficiency

The upgrade uses a smart tiering approach:
- **Routine queries** (70%) use cost-efficient models (GPT-4o-mini) for fast, affordable responses
- **Multi-step reasoning** (20%) uses Claude Sonnet 4.5 for detailed analysis
- **High-value tasks** (10%) use Claude Opus 4.6 or GPT-5.2 for maximum accuracy
- **Budget extraction and contract analysis** always use Opus 4.6 for the highest quality results

---

## Slash Commands Quick Reference

| Command | What It Does |
|---------|-------------|
| `/test` | Run automated tests (with optional filter) |
| `/test budget` | Run tests matching "budget" |
| `/review` | Review current code changes |
| `/check` | Quick health check (lint, types, tests) |
| `/build` | Run build and report errors |
| `/commit` | Create a commit with a descriptive message |
| `/explore` | Explore the codebase structure |
| `/docs` | Generate documentation |
| `/migrate` | Database migration helper |
| `/api` | API route scaffolding |
| `/daily` | Daily standup summary |
| `/setup` | Environment setup wizard |

---

*This document is auto-generated from the ForemanOS agent definitions. For technical details including file paths, trigger keywords, and implementation specifics, see `.claude/AGENTS_GUIDE.md`.*
