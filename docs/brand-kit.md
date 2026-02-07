# ForemanOS Brand Kit

**Last Updated:** February 2026
**Version:** 1.0

---

## 1. Brand Identity

### Brand Name
**ForemanOS** (one word, capital F and OS)

### Tagline
"Field Operations Intelligence"

### Brand Promise
AI-powered construction document intelligence that saves construction teams hours of manual searching.

### Brand Personality
- **Professional** - Enterprise-grade, trustworthy, reliable
- **Technical** - Construction-domain expertise, precision
- **Approachable** - Plain language, no jargon-for-jargon's-sake
- **Action-Oriented** - Results-focused, time-saving, efficiency

---

## 2. Logo System

### Current Logo Files

| File | Description | Recommended Use | Quality Assessment |
|------|-------------|-----------------|-------------------|
| `foremanos-new-logo.png` | White wordmark with orange "OR" and "E" accents on dark gray background | **PRIMARY** - Navigation headers, app chrome, marketing headers | GOOD - Clean, modern wordmark. Used across 8+ pages. This is the canonical logo. |
| `foremanos-logo.png` | Black stencil-style wordmark with orange swoosh on white background | Chat interface avatar, PDF templates, video poster | ISSUE - This is the OLD logo with a completely different visual style (stencil/grunge aesthetic vs clean modern). Should be deprecated. |
| `foremanos-logo-transparent.png` | White wordmark with orange accents on transparent background | Light text over dark backgrounds | GOOD - Matches new brand style but nearly invisible on white backgrounds. |
| `foremanos-full-logo.png` | Flowchart diagram ("Project Specific Chatbot" with goals list) | NOT A LOGO - This is an internal planning diagram | CRITICAL ISSUE - Not a logo at all. Should be removed from public/ or renamed to clearly indicate it is not a logo. |
| `logo-dark.png` | White wordmark for dark backgrounds | Dark UI contexts | GOOD - Matches new brand. Renders as white on white viewer (expected for dark-bg logo). |
| `logo-light.png` | Dark wordmark for light backgrounds | Light UI contexts | GOOD - Same design adapted for light backgrounds. Appears blank on white (extremely light). Needs verification. |
| `logo-mono-black.png` | Black monochrome wordmark | Print, monochrome contexts | GOOD - Clean single-color version. Appears blank on white viewer but likely has very light content. |
| `logo-mono-white.png` | White monochrome wordmark | Dark backgrounds, reversed contexts | GOOD - Clean single-color version for dark contexts. |
| `wp-logo.png` | Blue "W" with construction worker/gear icon (WP Principles brand) | **NOT FOREMANOS** - This is a separate company logo | ISSUE - Different brand entirely. If this is a parent company or partner, it should be in a separate directory. |
| `wp-logo-small.png` | Same as wp-logo.png, smaller size | Same as above | Same issue as above. |
| `wp-principles-logo.png` | Blue "W PRINCIPLES" with construction worker/gear icon | **NOT FOREMANOS** - Separate entity wordmark | ISSUE - Different brand. Should be in /public/partners/ or removed if unused. |

### Favicon & App Icons

| File | Size | Assessment |
|------|------|-----------|
| `favicon.svg` | 256x256 | ISSUE - SVG shows an orange hard hat icon on dark blue (#0a1e3d) background. This does NOT match the ForemanOS wordmark style. It looks like a generic construction icon. |
| `favicon-16.png` | 16x16 | Uses new logo style (appears correct but very small) |
| `favicon-32.png` | 32x32 | Uses new logo style (dark background with white/orange wordmark) |
| `favicon-48.png` | 48x48 | Uses new logo style |
| `apple-touch-icon.png` | 180x180 (standard) | Uses new logo style on dark background |
| `og-image.png` | Social sharing | Uses new logo on dark background - GOOD for social cards |

### Logo Usage Where

| Context | File Used | Component |
|---------|-----------|-----------|
| Landing page header | `foremanos-new-logo.png` | `components/landing/header.tsx` |
| Pricing page header | `foremanos-new-logo.png` | `app/pricing/page.tsx` (own header) |
| Dashboard | `foremanos-new-logo.png` | `app/dashboard/page.tsx` |
| Admin panel | `foremanos-new-logo.png` | `app/admin/page.tsx` |
| Project pages | `foremanos-new-logo.png` | `app/project/[slug]/page.tsx` |
| Login form | `foremanos-new-logo.png` | `components/login-form.tsx` |
| Signup page | `foremanos-new-logo.png` | `app/signup/page.tsx` |
| Sign out page | `foremanos-new-logo.png` | `app/signout/page.tsx` |
| Onboarding wizard | `foremanos-new-logo.png` | `components/onboarding-wizard.tsx` |
| Chat interface (bot avatar) | `foremanos-logo.png` (OLD) | `components/chat-interface.tsx` (3 instances) |
| Product tour (video poster) | `foremanos-logo.png` (OLD) | `app/product-tour/page.tsx` |
| PDF export template | `foremanos-logo.png` (OLD) | `lib/pdf-template.tsx` |
| Main app chrome | `foremanos-new-logo.png` | `app/main-app.tsx` |

### Critical Logo Issues

1. **Two incompatible logo designs in active use.** The old `foremanos-logo.png` (stencil/grunge style with orange swoosh) and the new `foremanos-new-logo.png` (clean modern wordmark) have completely different visual identities. The chat interface still uses the old logo in 3 places.

2. **`foremanos-full-logo.png` is not a logo.** It is an internal planning flowchart diagram. Remove from `public/` or rename to avoid confusion.

3. **Favicon SVG does not match the brand.** The favicon.svg shows a generic orange hard hat icon, not the ForemanOS wordmark or any recognizable brand element from either logo version.

4. **WP Principles logos are a different brand.** Three files (`wp-logo.png`, `wp-logo-small.png`, `wp-principles-logo.png`) feature a blue "W" construction worker icon that is not ForemanOS branding. These should be organized into a subdirectory if used as partner/parent logos, or removed.

5. **`logo-light.png` may be broken.** Appears nearly invisible, needs verification that it renders correctly on actual light backgrounds.

### Logo Usage Guidelines

#### Minimum Size
- Wordmark: 120px wide minimum for digital, 1 inch for print
- App icon/avatar: 32px minimum (use simplified mark, not full wordmark)

#### Clear Space
- Maintain padding equal to the height of the "O" in "FOREMANOS" on all sides
- Never crowd the logo with text, borders, or other elements

#### Backgrounds
- **Dark backgrounds (#1F2328 or darker):** Use `foremanos-new-logo.png` or `logo-dark.png`
- **Light backgrounds (#FFFFFF or lighter):** Use `logo-light.png` or `logo-mono-black.png`
- **Transparent overlays:** Use `foremanos-logo-transparent.png`
- **Monochrome contexts:** Use `logo-mono-black.png` or `logo-mono-white.png`

#### Do Not
- Use the old stencil-style logo (`foremanos-logo.png`) in new contexts
- Stretch, rotate, or distort the logo
- Place the logo on busy photographic backgrounds without a solid backing
- Change the orange/white color ratio in the wordmark
- Use the WP Principles logo as a ForemanOS logo

---

## 3. Color Palette

### Primary Colors

| Swatch | Name | Hex | CSS Variable | Usage |
|--------|------|-----|-------------|-------|
| Orange 500 | Primary Orange | `#F97316` | `--color-primary` | Primary CTAs, brand accent, active states |
| Orange 600 | Primary Hover | `#EA580C` | - | Button hover states |
| Orange 700 | Primary Active | `#C2410C` | - | Button pressed/active states |
| Orange 50 | Primary Tint | `#FFF7ED` | `--bg-accent` | Subtle backgrounds, highlights |

### Secondary Colors

| Swatch | Name | Hex | CSS Variable | Usage |
|--------|------|-----|-------------|-------|
| Blue Brand | Brand Blue | `#003B71` | `--client-primary` | Client-facing theme, About page headings |
| Blue Brand Light | Brand Blue Light | `#0052a3` | - | Gradients with brand blue |
| Blue 600 | Secondary Blue | `#2563EB` | `--color-secondary` | Links, secondary CTAs, info elements |
| Blue 500 | Info Blue | `#3B82F6` | `--color-info` | Info states, chart baselines |

### Background Colors (Dark Theme)

| Swatch | Name | Hex | CSS Variable | Usage |
|--------|------|-----|-------------|-------|
| Dark Base | Darkest BG | `#0d1117` | `--bg-dark-base` | Main dark background (GitHub-inspired) |
| Dark Surface | Card/Surface | `#1F2328` | `--bg-dark-surface`, `--color-charcoal` | Navigation, cards, elevated surfaces |
| Dark Hover | Hover State | `#2d333b` | `--bg-dark-card` | Hover states on dark surfaces |

### Background Colors (Light Theme)

| Swatch | Name | Hex | CSS Variable | Usage |
|--------|------|-----|-------------|-------|
| White | Primary BG | `#FFFFFF` | `--bg-primary` | Main content background |
| Slate 50 | Secondary BG | `#F8FAFC` | `--bg-secondary` | Section alternation, subtle backgrounds |

### Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| Success Green | `#10B981` | Success states, compliance passed, on-track indicators |
| Warning Amber | `#F59E0B` | Caution states, approaching limits |
| Error Red | `#EF4444` | Error states, critical issues, over-budget |
| Info Blue | `#3B82F6` | Informational, planned baselines |

### Role-Based Themes

| Role | Primary | Accent | Background |
|------|---------|--------|------------|
| Admin | `#6B46C1` (Purple) | `#9333EA` | `#F5F3FF` |
| Client | `#003B71` (Blue) | `#2563EB` | `#EFF6FF` |
| Guest | `#059669` (Green) | `#10B981` | `#ECFDF5` |

### Color Consistency Issues Found

1. **Demo page** (`app/demo/page.tsx`): Uses `bg-blue-600` and `ring-blue-600` for CTA buttons and form focus rings (10 instances). Brand CTA should be orange `#F97316`.
2. **About page** (`app/about/page.tsx`): Step circles use `bg-[#003B71]` (brand blue) instead of orange. CTA section uses blue gradient - inconsistent with primary orange brand.
3. **Product pages** (forms-checklists, scheduling-dispatch, etc.): Hero icons use `bg-blue-600` instead of brand orange. No LandingHeader.
4. **Pricing page**: Correctly uses `bg-[#F97316]` for CTAs - this is the standard.
5. **Security page CTA**: Uses `bg-green-600` gradient - off-brand for a primary CTA.
6. **86 instances of `bg-blue-600`** found across public-facing app pages, many where orange should be used.

---

## 4. Typography

### Font Families

| Font | CSS Variable | Weight Range | Usage |
|------|-------------|--------------|-------|
| **Space Grotesk** | `--font-headline` | 400-700 | Headlines (h1-h3), stat numbers, navigation |
| **Inter** | `--font-body` | 400-600 | Body text, paragraphs, form labels, descriptions |
| **Roboto Mono** | (inline style) | 400 | Toast notifications only (via Sonner config) |

### Type Scale (Tailwind classes used across pages)

| Element | Class | Size | Font |
|---------|-------|------|------|
| Page h1 | `text-4xl sm:text-5xl lg:text-6xl font-bold` | 36/48/60px | Space Grotesk (`font-headline`) |
| Section h2 | `text-3xl sm:text-4xl font-bold` | 30/36px | Space Grotesk (`font-headline`) |
| Card h3 | `text-xl font-semibold` or `text-2xl font-bold` | 20-24px | Space Grotesk (`font-headline`) |
| Body text | `text-gray-300` or `text-gray-600` | 16px | Inter (default `font-body`) |
| Small text | `text-sm text-gray-400` | 14px | Inter |
| Stats/Numbers | `text-4xl md:text-5xl font-bold` | 36-48px | Space Grotesk |

### Typography Issues

1. **Inconsistent headline font usage.** Many pages do NOT apply `font-headline` to their `h1`/`h2` elements (e.g., About page, Demo page, Pricing page). Only the landing hero and how-it-works sections consistently use `font-headline`.
2. **Roboto Mono for toasts** is an unexpected third font. Consider using Inter for toast consistency.

---

## 5. Tone of Voice

### Brand Voice Principles

| Principle | Do | Do Not |
|-----------|----|----|
| **Direct** | "Upload your plans. Get instant answers." | "We provide a comprehensive solution that enables..." |
| **Construction-native** | "Sheet A-101", "ADA 2010 Section 208.2", "Grid B-3" | Generic tech jargon like "leverage synergies" |
| **Confident** | "AI that truly understands construction plans" | "We try to help with construction documents" |
| **Specific** | "Save 10+ hours per week" "95%+ accuracy with citations" | Vague claims like "improve productivity" |
| **Respectful of expertise** | "Built for construction professionals" | Condescending ("even you can use AI") |

### Writing Style

- **Sentences:** Short, active voice. Lead with the benefit.
- **Numbers:** Use specific figures. "$37,500+ annual savings" beats "significant cost reduction."
- **Technical terms:** Use construction industry terms naturally. Do not over-explain basics that your audience already knows (PM, GC, AHJ, RFI).
- **CTAs:** Action verbs. "Start Free Trial" / "Try AI Plan Analysis" / "View Pricing Plans"
- **Error messages:** Problem + solution format. "Upload failed. The file exceeds 50MB--compress and try again."
- **Empty states:** Guide next action. "No documents yet. Upload your first file to get started."

### Tone by Context

| Context | Tone | Example |
|---------|------|---------|
| Marketing headlines | Bold, benefit-driven | "AI That Understands Construction Plans" |
| Feature descriptions | Clear, specific | "Traces MEP systems in 3D. Detects hard clashes and clearance violations." |
| Onboarding | Supportive, guiding | "Let's set up your first project. Start by uploading your plans." |
| Error states | Calm, solution-oriented | "Connection lost. Your work is saved--we'll retry automatically." |
| Success states | Confirming, brief | "Daily report saved for January 15." |
| Pricing | Transparent, value-focused | "2.6x cheaper than Fieldwire" |

---

## 6. Imagery & Iconography

### Icon System
- **Library:** Lucide React (used across all pages)
- **Icon size (feature sections):** `w-6 h-6` to `w-8 h-8` in colored containers
- **Icon containers:** Rounded square (`rounded-lg`) or circle (`rounded-full`) with semantic background color
- **Icon color:** White on colored backgrounds, or semantic color on light tinted backgrounds

### Photography
- **Current state:** No photography is used on any marketing page. All visual content is icon-based or text-based.
- **Recommendation:** Add construction site photography to hero sections and about page to build trust and visual interest. Focus on: professionals using tablets on-site, plan sets spread on desks, team collaboration scenes.

### Illustrations
- **Current state:** No illustrations. The chat demo in the hero section (`components/landing/hero.tsx`) serves as the primary visual, which is effective.
- **Video:** A product tour video is referenced (`/foremanos-tour.mp4`) on the product tour page.

---

## 7. Component Patterns

### Buttons

| Type | Style | Usage |
|------|-------|-------|
| Primary CTA | `bg-[#F97316] hover:bg-[#EA580C] text-white` | Sign Up, Get Started, Start Free Trial |
| Secondary CTA | `border-2 border-white text-white hover:bg-white/10` (dark bg) | View Pricing, Sign In |
| Ghost | `text-gray-300 hover:text-white hover:bg-white/10` | Login in header |
| Minimum height | `min-h-[44px]` (`--touch-target`) | All interactive buttons |

### Cards
- **Marketing:** `bg-white rounded-xl p-8 shadow-lg border border-gray-200 hover:shadow-xl`
- **Dark theme:** `bg-gray-800/50 rounded-lg p-6 border border-gray-700`
- **Pricing (popular):** `ring-4 ring-[#003B71] scale-105`

### Section Layout
- **Container:** `container mx-auto px-4 sm:px-6` (responsive padding)
- **Section padding:** `py-16` to `py-20`
- **Max content width:** `max-w-7xl` for grids, `max-w-4xl` for text-heavy content
- **Section alternation:** Alternate between `bg-white` and `bg-gray-900/50` (dark) or `bg-slate-50` (light)

---

## 8. Recommended Actions (Priority Order)

### P0 - Critical

1. **Retire `foremanos-logo.png`** (old stencil logo). Replace its 3 uses in `chat-interface.tsx` and 1 use in `pdf-template.tsx` with `foremanos-new-logo.png`.
2. **Remove or relocate `foremanos-full-logo.png`** - it is a flowchart diagram, not a logo.
3. **Redesign `favicon.svg`** to use the ForemanOS wordmark "F" or "FOS" mark instead of generic hard hat icon.

### P1 - High

4. **Standardize CTA color to orange across ALL pages.** The Demo page (10 instances of blue-600 CTAs) and Security page (green CTA) should use `bg-[#F97316] hover:bg-[#EA580C]`.
5. **Add `LandingHeader` to all public marketing pages.** Currently missing from: Demo, Integrations, Pricing (uses own header), all 6 Product/* pages, Landscaping solutions page, Weather Analytics.
6. **Add `Footer` to all public marketing pages.** Currently missing from most pages that also lack LandingHeader.

### P2 - Medium

7. **Organize WP Principles logos** into `public/partners/` subdirectory with documentation about their relationship to ForemanOS.
8. **Apply `font-headline` consistently** to all h1 and h2 elements on marketing pages.
9. **Verify `logo-light.png`** renders correctly - currently appears blank/invisible.
10. **Create a proper icon/mark version** of the ForemanOS logo for use as chat avatar and favicon, derived from the "new logo" design.
