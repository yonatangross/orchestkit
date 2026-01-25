---
name: create-server-component
description: Create React Server Component with auto-detected Next.js version. Use when creating server components.
user-invocable: true
argument-hint: [component-name]
---

Create server component: $ARGUMENTS

## Component Context (Auto-Detected)

- **Next.js Version**: !`grep -r '"next"' package.json 2>/dev/null | grep -oE '"next":\s*"[^"]*"' | grep -oE '[0-9]+\.[0-9]+' || echo "Not detected"`
- **App Directory**: !`find . -type d -name "app" 2>/dev/null | head -1 || echo "app"`
- **Existing Server Components**: !`find app -name "*.tsx" -o -name "*.ts" 2>/dev/null | xargs grep -l "async\|await" 2>/dev/null | wc -l | tr -d ' ' || echo "0"`
- **Database Client**: !`grep -r "prisma\|drizzle\|sql" package.json 2>/dev/null | head -1 | grep -oE 'prisma|drizzle|@prisma' || echo "Not detected"`

## Server Component Template

```typescript
/**
 * $ARGUMENTS Server Component
 * 
 * Generated: !`date +%Y-%m-%d`
 * Next.js: !`grep -r '"next"' package.json 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' || echo "App Router"`
 * 
 * NO 'use client' directive - this is a Server Component
 */

!`grep -q "prisma" package.json 2>/dev/null && echo "import { db } from '@/lib/db';" || echo "// Add database import if needed"`
import { Suspense } from 'react';

interface $ARGUMENTSProps {
  // Add props here
}

export default async function $ARGUMENTS({}: $ARGUMENTSProps) {
  // ✅ Server-only: Direct database access
  // If using Prisma, replace $ARGUMENTS with your model name:
  // const data = await db.$ARGUMENTS.findMany();
  // Otherwise, use your data fetching method:
  // const data = await fetchData();

  return (
    <div>
      <h1>$ARGUMENTS</h1>
      {/* Server Component content */}
    </div>
  );
}
```

## Usage

1. Review detected setup above
2. Update database query if using Prisma (replace $ARGUMENTS with actual model name)
3. Save to: `app/$ARGUMENTS/page.tsx` or `components/$ARGUMENTS.tsx`
4. No 'use client' directive - runs on server
