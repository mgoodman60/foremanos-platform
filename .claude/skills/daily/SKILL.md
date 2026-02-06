---
name: daily
description: Daily standup summary
---

Generate a daily standup summary for the project.

## Steps

1. Check git log for recent commits
2. Check for open PRs
3. Check for failing tests
4. Check for build status
5. Summarize work done and next steps

## Commands

```bash
# Recent commits
git log --oneline -10 --since="yesterday"

# Current branch status
git status

# Open PRs (if gh available)
gh pr list --state open
```

## Output Format

```markdown
## Daily Standup - [Date]

### Yesterday
- [Completed work from commits]

### Today
- [Planned work based on context]

### Blockers
- [Any issues found]

### Notes
- [Build status, test status, etc.]
```
