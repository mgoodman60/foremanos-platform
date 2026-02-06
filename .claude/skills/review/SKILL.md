---
name: review
description: Code review current changes
---

Review current code changes for issues.

## Steps

1. Run `git diff` to see changes
2. Analyze changes for:
   - Security issues
   - Performance problems
   - Code style violations
   - Missing error handling
   - Test coverage gaps
3. Provide actionable feedback

## Review Checklist

- [ ] No security vulnerabilities
- [ ] Error handling present
- [ ] No hardcoded secrets
- [ ] Types are correct
- [ ] No console.log in production code
- [ ] Tests cover new code

## Output Format

```markdown
## Code Review

### Summary
X files changed, X issues found

### Issues
- **[severity]** file:line - description

### Suggestions
- Improvement ideas
```
