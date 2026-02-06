---
name: setup
description: Environment setup wizard
---

Help set up the ForemanOS development environment.

## Steps

1. Check Node.js version (v18+)
2. Check npm installed
3. Run `npm install`
4. Check for `.env` file
5. Run `npx prisma generate`
6. Verify database connection
7. Seed test data if needed

## Commands

```bash
node --version
npm --version
npm install
npx prisma generate
npx prisma db push
npm run seed:test-user
```

## Environment Variables

Required:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

Optional:
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `AWS_REGION`, `AWS_BUCKET_NAME`
- `REDIS_URL`

## Verification

```bash
npm run dev
# Should start on localhost:3000
```
