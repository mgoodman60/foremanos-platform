# DeepAgent Troubleshooting Prompt

If DeepAgent is stuck processing, try this prompt:

---

## Prompt for DeepAgent

```
I'm having trouble pulling from GitHub. The main branch has been updated with Phase 2 changes (25 commits merged from refactor/phase2-chat-api).

**Current Status:**
- Branch: main
- Remote: https://github.com/mgoodman60/foremanos.git
- Latest commit: 03b66f6 [CURSOR] Phase 2: Add workflow docs, prompts, and verification report for GitHub

**What to do:**

1. **Check if pull is actually stuck or just slow:**
   - If it's been more than 5 minutes, something may be wrong
   - Check if there are any error messages in logs

2. **Try a fresh pull:**
   ```bash
   git fetch origin
   git reset --hard origin/main
   ```
   This ensures you have the exact state from GitHub.

3. **If pull works but build/tests are stuck:**
   - Check if `npm install` or `yarn install` is hanging (might be dependency issues)
   - Check if `npm run build` is stuck (might be TypeScript compilation issues)
   - Check if tests are running indefinitely (might be a test hanging)

4. **If you see specific errors, report them:**
   - Authentication errors → Check GitHub credentials
   - Build errors → Share the error output
   - Test failures → Share which tests failed
   - Dependency errors → Share the npm/yarn error

5. **If everything seems fine but it's just slow:**
   - Phase 2 added a lot of new code (middleware, processors, tests)
   - Build might take longer than usual
   - Tests might take longer (26 tests + snapshots)
   - This is normal - just wait it out

**Report back:**
- Did the pull succeed?
- What step is it stuck on? (pull, install, build, test, deploy)
- Any error messages?
- How long has it been stuck?
```

---

## Alternative: Force Fresh Start

If DeepAgent is completely stuck, try this:

```
Stop whatever you're doing. Start fresh:

1. Navigate to the repo directory
2. Run: `git fetch origin && git reset --hard origin/main`
3. Verify you're on main: `git branch --show-current`
4. Verify latest commit: `git log --oneline -1`
5. Then proceed with: install dependencies, build, test, deploy

Report what you see at each step.
```

---

## Quick Check Commands

If you want DeepAgent to just verify the current state:

```
Run these commands and report the output:

1. `git remote -v` - Check remote URL
2. `git branch --show-current` - Check current branch
3. `git log --oneline -3` - Check latest commits
4. `git status` - Check if there are uncommitted changes
5. `git fetch origin` - Fetch latest from GitHub (no merge)
6. `git log origin/main --oneline -3` - Check what's on GitHub main

This will help diagnose if the issue is:
- Remote not configured correctly
- Wrong branch
- Local vs remote mismatch
- Something else
```
