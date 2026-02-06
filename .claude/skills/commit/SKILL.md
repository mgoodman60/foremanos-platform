---
name: commit
description: Smart commit with message
---

Create a commit with an auto-generated message.

## Steps

1. Run `git status` to see changes
2. Run `git diff` to understand changes
3. Generate descriptive commit message
4. Stage appropriate files
5. Create commit

## Commands

```bash
git status
git diff --staged
git diff
git add [specific files]
git commit -m "message"
```

## Commit Message Format

```
<type>: <short description>

<optional body>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- refactor: Code restructuring
- test: Adding tests
- chore: Maintenance

## Rules

- Stage specific files, not `git add -A`
- Never commit .env or secrets
- Use descriptive messages
- Add co-author attribution
