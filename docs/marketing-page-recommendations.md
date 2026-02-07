# Marketing Page Recommendations

**Purpose:** Identify gaps in ForemanOS public-facing pages for SEO, conversion, and trust-building.
**Date:** February 2026

---

## Current Page Inventory

### Marketing/Public Pages (21 total)

| Page | Path | Has Header | Has Footer | Purpose |
|------|------|-----------|-----------|---------|
| Homepage | `/` | LandingHeader | Footer | Main landing, hero, features |
| About | `/about` | LandingHeader | Footer | Company story, value props |
| Pricing | `/pricing` | Own header | No footer | Subscription tiers |
| Product Tour | `/product-tour` | LandingHeader | No footer | Feature deep-dive, video |
| Security | `/security` | LandingHeader | No footer | Trust/compliance |
| Demo Request | `/demo` | No header | No footer | Lead capture form |
| Integrations | `/integrations` | No header | No footer | Coming soon placeholder |
| Weather Analytics | `/weather-analytics` | No header | No footer | App feature (behind auth) |
| Product: Forms & Checklists | `/product/forms-checklists` | No header | No footer | Feature page |
| Product: Project Dashboard | `/product/project-dashboard` | No header | No footer | Feature page |
| Product: Quotes & Clients | `/product/quotes-clients` | No header | No footer | Feature page |
| Product: Reporting | `/product/reporting` | No header | No footer | Feature page |
| Product: Scheduling & Dispatch | `/product/scheduling-dispatch` | No header | No footer | Feature page |
| Product: Team Communication | `/product/team-communication` | No header | No footer | Feature page |
| Solutions: General Contractors | `/solutions/general-contractors` | LandingHeader | No footer | Vertical landing page |
| Solutions: Construction Managers | `/solutions/construction-managers` | LandingHeader | No footer | Vertical landing page |
| Solutions: Electrical | `/solutions/electrical` | LandingHeader | No footer | Vertical landing page |
| Solutions: Plumbing & HVAC | `/solutions/plumbing-hvac` | LandingHeader | No footer | Vertical landing page |
| Solutions: Concrete & Masons | `/solutions/concrete-masons` | LandingHeader | No footer | Vertical landing page |
| Solutions: Site Work | `/solutions/site-work` | LandingHeader | No footer | Vertical landing page |
| Solutions: Landscaping | `/solutions/landscaping` | No header | No footer | Vertical landing page |

### Auth Pages (6 total)

| Page | Path | Notes |
|------|------|-------|
| Login | `/login` | LoginForm component, dark theme |
| Signup | `/signup` | Multi-step with tier selection |
| Forgot Password | `/forgot-password` | - |
| Reset Password | `/reset-password` | - |
| Verify Email | `/verify-email` | - |
| Sign Out | `/signout` | - |

---

## Recommended New Pages

### Tier 1: High-Impact SEO & Conversion Pages

#### 1. Blog / Resource Center (`/blog`)
**SEO Impact:** HIGH
**Why:** Construction professionals actively search for guidance on code compliance, project management best practices, and technology adoption. A blog positions ForemanOS as a domain authority and captures long-tail search traffic.

**Suggested initial topics (based on actual ForemanOS capabilities):**
- "How to Read ADA 2010 Parking Requirements (With Calculator)"
- "MEP Clash Detection: What It Is and Why You Need It Before Construction"
- "5 Ways AI is Changing Construction Document Management in 2026"
- "Understanding IBC 2021 Corridor Width Requirements"
- "From Manual Takeoffs to AI: A Practical Guide"

#### 2. Case Studies / Success Stories (`/case-studies`)
**SEO Impact:** HIGH | **Conversion Impact:** HIGH
**Why:** Construction buyers want proof from peers, not marketing claims. Case studies convert better than any other content type for B2B SaaS.

**Template for each case study:**
- Company profile (trade, size, location)
- Challenge they faced
- How ForemanOS solved it
- Specific metrics (time saved, cost avoided, documents processed)
- Quote from the user

#### 3. Comparison Pages (`/compare/[competitor]`)
**SEO Impact:** HIGH
**Why:** The pricing page already mentions "2.6x cheaper than Fieldwire, 7.9x cheaper than Handoff AI, 25x cheaper than Procore." Dedicated comparison pages capture high-intent "ForemanOS vs X" search traffic.

**Recommended pages:**
- `/compare/procore` - ForemanOS vs Procore
- `/compare/fieldwire` - ForemanOS vs Fieldwire
- `/compare/plangrid` - ForemanOS vs PlanGrid
- `/compare/bluebeam` - ForemanOS vs Bluebeam Revu
- `/compare/handoff-ai` - ForemanOS vs Handoff AI

**Content for each:** Feature comparison table, pricing comparison, use case differences, migration guide.

#### 4. FAQ Standalone Page (`/faq`)
**SEO Impact:** MEDIUM
**Why:** The pricing page has inline FAQ but it only covers billing questions. A dedicated FAQ page captures search traffic for operational questions and reduces support load.

**Sections:**
- Getting Started (upload limits, file types, setup time)
- AI & Accuracy (how the AI works, citation accuracy, model details)
- Compliance & Codes (which codes supported, update frequency)
- Security & Data (encryption, data ownership, export)
- Billing & Plans (expand from existing pricing FAQ)
- Team Management (roles, sharing, access control)

### Tier 2: Trust & Legal Pages

#### 5. Terms of Service (`/terms`)
**Why:** Currently missing. Required for any SaaS product accepting payments. The signup flow and Stripe checkout should link to this.

#### 6. Privacy Policy (`/privacy`)
**Why:** Currently missing. Required by GDPR (mentioned on the security page as "GDPR compliant"), Stripe, and Google. Legally required.

#### 7. Cookie Policy (`/cookies`)
**Why:** The site loads third-party scripts (Abacus AI chatbot). Cookie consent and policy are legally required in many jurisdictions.

#### 8. Testimonials / Reviews Page (`/reviews`)
**Conversion Impact:** HIGH
**Why:** Social proof is the single biggest trust signal for construction buyers. A dedicated page with verified reviews, star ratings, and video testimonials would significantly improve conversion.

### Tier 3: Conversion & Engagement Pages

#### 9. ROI Calculator (`/roi-calculator`)
**Conversion Impact:** HIGH
**Why:** The About page claims "10+ hours/week saved" and "$37,500+ annual savings per PM." An interactive calculator where prospects input their team size, hourly rate, and document volume would make these claims tangible and personalized.

**Inputs:** Number of PMs, hourly fully-loaded rate, hours spent searching docs/week, number of projects.
**Outputs:** Annual time savings, annual cost savings, payback period, ROI percentage.

#### 10. Free Tools / ADA Checker (`/tools/ada-checker`)
**SEO Impact:** HIGH | **Conversion Impact:** MEDIUM
**Why:** ForemanOS already has ADA 2010 compliance checking built in. Offering a free, limited version as a standalone tool would drive organic traffic and demonstrate product value. This is a proven SaaS growth strategy.

**Concept:** Enter parking count, get ADA requirement calculation with code citation. Upsell to full product for plan upload + automated checking.

#### 11. Resource Library (`/resources`)
**Why:** A central hub linking to blog posts, case studies, guides, webinar recordings, and the product tour video. Helps SEO through internal linking and gives prospects a reason to return.

#### 12. Changelog / What's New (`/changelog`)
**Why:** Shows active development, builds confidence that the product is improving. Construction buyers worry about buying software that gets abandoned.

### Tier 4: Industry-Specific SEO Landing Pages

#### 13. Additional Solution Verticals

The following trades/roles are supported by the codebase but do not have landing pages:

| Page | Path | Target Audience |
|------|------|----------------|
| Project Managers | `/solutions/project-managers` | PMs managing multiple projects |
| Estimators | `/solutions/estimators` | Takeoff and bidding professionals |
| MEP Contractors | `/solutions/mep-contractors` | Specifically HVAC + plumbing + electrical combined |
| Roofing | `/solutions/roofing` | Roofing contractors |
| Painting | `/solutions/painting` | Painting contractors |
| Fire Protection | `/solutions/fire-protection` | Fire sprinkler and alarm contractors |
| Owner/Developers | `/solutions/owners` | Property developers and owners |
| Architects | `/solutions/architects` | Plan review and coordination |
| Inspectors | `/solutions/inspectors` | Code compliance and field inspection |

#### 14. Use Case Pages

| Page | Path | Focus |
|------|------|-------|
| Plan Review | `/use-cases/plan-review` | AI-assisted plan review workflow |
| Bid Preparation | `/use-cases/bid-preparation` | Using ForemanOS for takeoffs and bid analysis |
| Field Inspection | `/use-cases/field-inspection` | Mobile access to plans during inspections |
| Code Compliance | `/use-cases/code-compliance` | ADA, IBC, NFPA compliance checking |
| MEP Coordination | `/use-cases/mep-coordination` | Clash detection and MEP path tracing |
| Document Control | `/use-cases/document-control` | Centralized document management |

---

## Page Gap Summary

| Category | Current | Missing | Priority |
|----------|---------|---------|----------|
| SEO Content (Blog) | 0 pages | Blog + 5 initial posts | P1 |
| Social Proof (Case Studies) | 0 pages | 3-5 case studies | P1 |
| Competitor Comparisons | 0 pages | 3-5 comparison pages | P1 |
| Legal | 0 pages | Terms, Privacy, Cookies | P0 (legal requirement) |
| FAQ | Inline only | Standalone FAQ | P2 |
| Conversion Tools | 0 pages | ROI Calculator, Free ADA Tool | P2 |
| Industry Verticals | 7 pages | 9 more verticals | P3 |
| Use Case Pages | 0 pages | 6 use case pages | P3 |
| Resource Hub | 0 pages | Resource library | P3 |
| Changelog | 0 pages | What's New page | P3 |

---

## SEO Quick Wins (No New Pages Required)

1. **Add `<Footer>` to all marketing pages** -- currently 11 pages have no footer, which means no internal links at the bottom. This hurts SEO crawl depth and user navigation.

2. **Add structured data (JSON-LD)** to the homepage, pricing page, and FAQ sections for rich snippets in search results. Particularly `FAQPage` schema for the pricing FAQ and `SoftwareApplication` schema for the homepage.

3. **Add meta descriptions** where missing. Several pages have generic or missing meta descriptions.

4. **Internal linking between solution pages.** Currently each solution page is a dead end. Cross-link between related trades (e.g., Electrical links to Plumbing & HVAC, General Contractors links to all trades).

5. **The Integrations page is a placeholder.** Either flesh it out with current integrations (OneDrive is already built) or remove from navigation until ready. A "coming soon" page with no content hurts SEO.
