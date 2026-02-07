# Changelog

All notable changes to ForemanOS will be documented in this file.

## [Unreleased] - 2026-02-07

### Marketing Overhaul

A comprehensive marketing and branding update across 30+ pages and components.

#### Copy & Messaging (30+ pages)
- **Homepage**: Rewritten with benefit-first messaging and trade-specific examples
  - New headline: "Stop Searching Plans. Start Getting Answers."
  - 15 feature cards rewritten with concrete outcomes
  - Action-specific CTAs with price anchors
- **Core pages**: Problem/solution framing for About, Pricing, Demo, Product Tour, Security
  - Fixed stale AI model references (removed GPT-4o-mini/Claude 3.5)
  - Replaced vague security promises with specific measures (AES-256, TLS 1.3, JWT auth, Cloudflare R2)
- **Solutions pages (7)**: Trade-specific terminology and workflow focus
  - Electrical, plumbing, HVAC, general contracting, site prep, landscaping, concrete
  - Removed fake features from landscaping page
- **Product pages (6)**: Outcome-focused headlines and descriptions
  - Forms & checklists, project dashboard, quotes & clients, reporting, scheduling, team communication
- **Other pages**: Upgraded integrations page, updated login/signup taglines

#### UI & Branding Fixes
- **Logo migration**: Replaced old stencil-style logo with new logo in:
  - `components/chat-interface.tsx` (3 instances)
  - `lib/pdf-template.tsx` (1 instance)
  - `app/product-tour/page.tsx` (1 instance)
- **CTA color consistency**: Standardized to brand orange (`#F97316`)
  - Demo page: All blue CTAs → orange (12 instances)
  - Security page: Green gradient CTA → orange gradient
- **Navigation consistency**:
  - Added `LandingHeader` to 11 missing pages (demo, 6 product pages, integrations, landscaping)
  - Added `Footer` to 19 missing pages (7 solutions, 6 product, demo, integrations, pricing, product-tour, security)
- **Pricing page**: Replaced custom header with shared `LandingHeader` component

#### Documentation Created
- `docs/brand-kit.md` - Logo system, color palette, typography, tone guidelines
- `docs/marketing-page-recommendations.md` - 14 recommended new pages (blog, case studies, legal, etc.)
- `docs/ui-improvement-recommendations.md` - 4-sprint UI improvement roadmap

#### Impact
- 41 files changed, 3,529 insertions, 620 deletions
- Improved message clarity and consistency across all public-facing pages
- Established visual brand consistency with orange CTAs and shared navigation components
