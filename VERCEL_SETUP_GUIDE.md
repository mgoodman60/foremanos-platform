# ForemanOS Vercel Deployment Guide

This guide walks you through deploying ForemanOS to Vercel step-by-step.

---

## Prerequisites

Before starting, make sure you have:
- [ ] A Vercel account (free at vercel.com)
- [ ] A PostgreSQL database (we'll set this up)
- [ ] An Anthropic or OpenAI API key
- [ ] An AWS account with S3 bucket (for file storage)
- [ ] (Optional) Stripe account for payments

---

## Step 1: Install Vercel CLI

Open your terminal and run:

```bash
npm install -g vercel
```

Then log in:

```bash
vercel login
```

This will open a browser window to authenticate.

---

## Step 2: Link Your Project

Navigate to your project directory and run:

```bash
cd /path/to/foremanos
vercel link
```

You'll be asked:
1. **Set up and deploy?** → Yes
2. **Which scope?** → Select your account
3. **Link to existing project?** → No (first time) or Yes (if already created)
4. **Project name?** → `foremanos` (or your preferred name)
5. **Directory?** → `./` (current directory)

---

## Step 3: Create a PostgreSQL Database

### Option A: Vercel Postgres (Recommended - Easiest)

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Click **Storage** tab
4. Click **Create Database** → **Postgres**
5. Choose a region close to you
6. Click **Create**

Vercel will automatically add `DATABASE_URL` and related variables to your project.

### Option B: Neon (Free Tier Available)

1. Go to [neon.tech](https://neon.tech) and create account
2. Create a new project
3. Copy the connection string (looks like `postgresql://user:pass@host/db`)
4. You'll add this as `DATABASE_URL` in Step 4

### Option C: Supabase (Free Tier Available)

1. Go to [supabase.com](https://supabase.com) and create account
2. Create a new project
3. Go to Settings → Database → Connection string
4. Copy the URI and use as `DATABASE_URL`

---

## Step 4: Set Environment Variables

Go to your Vercel project dashboard:
1. Click **Settings** tab
2. Click **Environment Variables** in the sidebar
3. Add each variable below:

### Required Variables

| Name | Value | How to Get It |
|------|-------|---------------|
| `DATABASE_URL` | `postgresql://...` | From Step 3 (auto-added if using Vercel Postgres) |
| `NEXTAUTH_SECRET` | `K7xm...` (32 chars) | Run: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` | Your Vercel URL (set after first deploy) |

### AI Provider (Need at least one)

| Name | Value | How to Get It |
|------|-------|---------------|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `OPENAI_API_KEY` | `sk-proj-...` | [platform.openai.com](https://platform.openai.com) → API Keys |

### AWS S3 Storage (Required for file uploads)

| Name | Value | How to Get It |
|------|-------|---------------|
| `AWS_REGION` | `us-west-2` | Your S3 bucket region |
| `AWS_BUCKET_NAME` | `foremanos-uploads` | Your S3 bucket name |
| `AWS_ACCESS_KEY_ID` | `AKIA...` | AWS IAM → Create access key |
| `AWS_SECRET_ACCESS_KEY` | `wJal...` | Same as above |

### Stripe (Optional - for subscriptions)

| Name | Value | How to Get It |
|------|-------|---------------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → API keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Same location |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe → Webhooks → Create endpoint |

### Optional Services

| Name | Value | Purpose |
|------|-------|---------|
| `REDIS_URL` | `redis://...` | Caching (falls back to memory) |
| `OPENWEATHERMAP_API_KEY` | API key | Weather data |
| `RESEND_API_KEY` | API key | Email notifications |

---

## Step 5: Initialize the Database

After setting `DATABASE_URL`, run this command locally:

```bash
# Push the schema to create all tables
npx prisma db push

# Or if you prefer migrations
npx prisma migrate deploy
```

You can also use the automated script:

```bash
npm run setup:database
```

---

## Step 6: Deploy

### First Deployment

```bash
vercel --prod
```

This will:
1. Build your project
2. Deploy to Vercel's edge network
3. Give you a URL like `https://foremanos-xxx.vercel.app`

### Update NEXTAUTH_URL

After your first deploy:
1. Copy the Vercel URL
2. Go to Settings → Environment Variables
3. Update `NEXTAUTH_URL` to your actual URL
4. Redeploy: `vercel --prod`

---

## Step 7: Configure Stripe Webhooks (If Using Payments)

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Enter URL: `https://your-app.vercel.app/api/stripe/webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Copy the **Signing secret** and add as `STRIPE_WEBHOOK_SECRET`

---

## Step 8: Create Admin User

After deployment, create your first admin user:

1. Go to your app and sign up
2. Connect to your database and run:

```sql
UPDATE "User" SET role = 'admin', "isApproved" = true WHERE email = 'your@email.com';
```

Or use Prisma Studio:
```bash
npx prisma studio
```

---

## Step 9: Verify Everything Works

### Checklist

- [ ] Homepage loads
- [ ] Can sign up and log in
- [ ] Can create a project
- [ ] Can upload a document
- [ ] Chat responds (requires AI API key)
- [ ] Files save to S3 (requires AWS credentials)

### Test Chat

1. Log in and go to a project
2. Upload a document (PDF works best)
3. Wait for processing to complete
4. Ask a question about the document

---

## Troubleshooting

### "Database connection failed"
- Verify `DATABASE_URL` is correct
- Check if database allows connections from Vercel IPs
- For Vercel Postgres: Should work automatically

### "Unauthorized" errors
- Check `NEXTAUTH_SECRET` is set
- Check `NEXTAUTH_URL` matches your actual domain
- Clear cookies and try again

### "Chat not responding"
- Verify `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set
- Check API key has credits/quota

### "File upload failed"
- Verify all AWS variables are set
- Check S3 bucket CORS configuration allows your domain
- Verify IAM user has S3 permissions

### Build fails
- Check Vercel build logs for specific errors
- Run `npm run build` locally to reproduce

---

## AWS S3 Setup (If Needed)

### Create S3 Bucket

1. Go to [AWS S3 Console](https://s3.console.aws.amazon.com)
2. Click **Create bucket**
3. Name: `foremanos-uploads` (or your preference)
4. Region: Choose closest to your users
5. Uncheck "Block all public access" (we use presigned URLs)
6. Create bucket

### Configure CORS

1. Select your bucket
2. Go to **Permissions** → **CORS**
3. Add this configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["https://your-app.vercel.app", "http://localhost:3000"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### Create IAM User

1. Go to [AWS IAM](https://console.aws.amazon.com/iam)
2. Users → Create user
3. Name: `foremanos-s3`
4. Attach policy: `AmazonS3FullAccess` (or create custom policy for your bucket)
5. Create access key → Copy ID and Secret

---

## Custom Domain (Optional)

1. Go to Vercel Dashboard → Settings → Domains
2. Add your domain
3. Update DNS records as instructed
4. Update `NEXTAUTH_URL` to your custom domain
5. Redeploy

---

## Monitoring

### Vercel Analytics

Enable in your Vercel dashboard for:
- Page views and visitors
- Web Vitals performance
- Error tracking

### Logs

View runtime logs:
```bash
vercel logs your-app.vercel.app
```

Or in dashboard: Deployments → Select deployment → Logs

---

## Support

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)
- **ForemanOS Issues**: Check CLAUDE.md for known issues and solutions
