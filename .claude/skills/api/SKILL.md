---
name: api
description: API route scaffolding
---

Create a new API route with proper structure.

## Usage

- `/api projects/budget` - Create route at app/api/projects/budget/route.ts

## Route Template

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Implementation

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Route Pattern

```
Auth Check → Rate Limit → Validation → Business Logic → Response
```

## File Location

`app/api/$ARGUMENTS/route.ts`
