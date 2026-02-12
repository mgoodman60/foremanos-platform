# ForemanOS - Construction Project Management Platform

A comprehensive AI-powered construction project management platform built with Next.js, featuring document intelligence, schedule management, budget tracking, and field operations.

## 🚀 Features

- **AI-Powered Chat**: RAG-based document Q&A with source citations
- **Document Intelligence**: Automatic extraction from plans, specs, schedules
- **Schedule Management**: Gantt charts, 3-week lookahead, critical path analysis
- **Budget Tracking**: Cost codes, change orders, EVM dashboard, S-curve analysis
- **MEP Submittals**: Workflow management with quantity verification
- **Daily Reports**: Field operations logging with photo capture
- **CAD/BIM Integration**: Autodesk Forge viewer for DWG/RVT files
- **Weather Integration**: Impact forecasting and alerts

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- Yarn package manager
- AWS account (for S3 file storage)
- API keys for AI services (Anthropic/OpenAI)

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/foremanos.git
cd foremanos
```

### 2. Install Dependencies

```bash
yarn install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 4. Set Up Database

```bash
# Create PostgreSQL database
createdb foremanos

# Run migrations
yarn prisma migrate deploy

# Generate Prisma client
yarn prisma generate

# (Optional) Seed initial data
yarn prisma db seed
```

### 5. Run Development Server

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🏗️ Project Structure

```
├── app/                    # Next.js App Router
│   ├── api/               # 388 API routes
│   ├── dashboard/         # User dashboard
│   ├── project/[slug]/    # Project pages
│   └── admin/             # Admin panel
├── components/            # React components
│   ├── ui/               # Shadcn/Radix primitives
│   ├── chat/             # Chat interface
│   ├── budget/           # Budget management
│   ├── schedule/         # Schedule components
│   └── submittals/       # Submittal workflow
├── lib/                   # Utilities & services
│   ├── db.ts             # Prisma client
│   ├── auth-options.ts   # NextAuth config
│   ├── s3.ts             # AWS S3 operations
│   └── rag.ts            # RAG system
├── prisma/
│   └── schema.prisma     # 112 database models
└── public/               # Static assets
```

## 🔑 Required Services

| Service | Purpose | Required |
|---------|---------|----------|
| PostgreSQL | Database | ✅ Yes |
| AWS S3 | File storage | ✅ Yes |
| Anthropic/OpenAI | AI/LLM | ✅ Yes |
| Stripe | Payments | Optional |
| Autodesk | CAD viewing | Optional |
| Redis | Rate limiting | Optional |

## 📝 Scripts

```bash
yarn dev          # Start development server
yarn build        # Build for production
yarn start        # Start production server
yarn lint         # Run ESLint
yarn prisma studio # Open Prisma database GUI
```

## 🧪 Testing

```bash
npm test              # Run all tests (903 tests)
npm test -- --run     # Run once without watch mode
npm run test:watch    # Watch mode
npx playwright test   # Run E2E tests
```

Key test suites cover: RAG scoring, rate limiting, authentication, Stripe integration, S3 operations, access control, password validation, webhooks, Redis caching, and document processing.

## 🚢 Deployment

### Vercel (Production)

ForemanOS is deployed on Vercel. Production deploys automatically when you push to `main`:

```bash
git push origin main
```

Manual deploy (if needed):
```bash
npx vercel --prod
```

Production URL: https://foremanos.vercel.app

### Local Production Build

```bash
yarn build
yarn start
```

### Environment Variables for Production

- Set `NEXTAUTH_URL` to your production domain
- Use live Stripe keys instead of test keys
- Configure proper AWS credentials

## 📄 License

Proprietary - All rights reserved

## 🤝 Support

Contact: ForemanOS@outlook.com
