---
name: test
description: Run tests with optional filter
---

Run ForemanOS tests. Use optional argument to filter.

## Usage

- `/test` - Run all tests
- `/test rag` - Run tests matching "rag"
- `/test __tests__/lib/rag.test.ts` - Run specific file

## Commands

```bash
# All tests
npm test -- --run

# Filtered
npm test -- $ARGUMENTS --run

# Single file
npm test -- __tests__/lib/$ARGUMENTS.test.ts --run
```

## Expected Output

Report:
- Tests passed/failed/skipped
- Failed test details
- Coverage summary if available
