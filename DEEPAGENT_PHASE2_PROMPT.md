# DeepAgent – Phase 2 Deploy Prompt

Copy the prompt below and give it to DeepAgent.

---

## Prompt for DeepAgent

```
Pull the latest from GitHub (main branch) and deploy ForemanOS.

**What’s in this deploy (Phase 2 – Chat API refactor):**
- Chat API route refactored: middleware and processors extracted, route reduced from ~1,310 to ~863 lines.
- New modules: lib/chat/feature-flags.ts, lib/chat/middleware/, lib/chat/processors/.
- New tests: integration tests for middleware, processors, and full flow (Vitest).
- New chat route is behind feature flags; default behavior is unchanged until you set:
  - USE_NEW_CHAT_ROUTE=true
  - CHAT_ROLLOUT_PERCENTAGE=10 (or higher)

**Steps:**
1. Pull latest from origin/main.
2. Install dependencies (npm install or yarn install).
3. Run database migrations if any (e.g. npx prisma migrate deploy).
4. Run the build (npm run build or yarn build).
5. Run tests if your pipeline includes them (e.g. npm run test -- --run).
6. Deploy to production (foremanos.site or your usual target).
7. If you use .workflow-status.json, set deployment.deepAgentStatus to "completed" (or your usual value) after a successful deploy.

**Notes:**
- No env changes required for current behavior; the refactored chat route is off by default.
- If the build or tests fail, fix any issues and redeploy, then report what was fixed.
```

---

## Short version (if DeepAgent only needs minimal context)

```
Pull latest from main and deploy. Phase 2 Chat API refactor is merged; new route is behind feature flags (USE_NEW_CHAT_ROUTE). Run install, migrations if any, build, then deploy.
```
