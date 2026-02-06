---
name: docs
description: Generate documentation
---

Generate documentation for specified code.

## Usage

- `/docs lib/rag.ts` - Document specific file
- `/docs api` - Document API endpoints
- `/docs` - Update CLAUDE.md

## Documentation Types

### JSDoc for Functions
```typescript
/**
 * Brief description.
 *
 * @param name - Parameter description
 * @returns Return value description
 * @throws {Error} When this happens
 */
```

### API Documentation
```markdown
## POST /api/endpoint

Description of what it does.

### Request
### Response
### Errors
```

## Output

Generate documentation that is:
- Accurate to the code
- Concise but complete
- Following existing patterns
