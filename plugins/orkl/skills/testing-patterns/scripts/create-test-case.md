---
name: create-test-case
description: Create test case with auto-detected test framework and patterns. Use when creating test cases.
user-invocable: true
argument-hint: [component-name]
---

Create test case for: $ARGUMENTS

## Test Context (Auto-Detected)

- **Test Framework**: !`grep -r "jest\|vitest\|@testing-library" package.json 2>/dev/null | head -1 | grep -oE 'jest|vitest|@testing-library' || echo "jest (recommended)"`
- **Test Directory**: !`find . -type d \( -name "__tests__" -o -name "tests" -o -name "*.test.*" -o -name "*.spec.*" \) 2>/dev/null | head -1 || echo "__tests__"`
- **Existing Tests**: !`find . -name "*test*.ts" -o -name "*test*.tsx" -o -name "*.spec.*" 2>/dev/null | wc -l | tr -d ' ' || echo "0"`
- **Component Files**: !`find . -name "*.tsx" -o -name "*.ts" 2>/dev/null | grep -E "(component|Component)" | head -3 || echo "No component files found"`

## Your Task

Create a test case for component: **$ARGUMENTS**

Locate the component file first, then create the corresponding test file.

## Test Case Template

```typescript
/**
 * Test Case: $ARGUMENTS
 * 
 * Generated: !`date +%Y-%m-%d`
 * Framework: !`grep -r "jest\|vitest" package.json 2>/dev/null | head -1 | grep -oE 'jest|vitest' || echo "jest"`
 */

!`grep -q "vitest" package.json 2>/dev/null && echo "import { describe, it, expect } from 'vitest';" || echo "import { describe, it, expect } from '@jest/globals';"`
!`grep -q "@testing-library/react" package.json 2>/dev/null && echo "import { render, screen } from '@testing-library/react';" || echo "// Install: npm install @testing-library/react"`

import { $ARGUMENTS } from './$ARGUMENTS';

describe('$ARGUMENTS', () => {
  it('should render correctly', () => {
    // Your test implementation
  });
});
```

## Usage

1. Review detected framework above
2. Locate component file: `components/$ARGUMENTS.tsx` or similar
3. Save test to: `__tests__/$ARGUMENTS.test.tsx`
4. Run: `npm test $ARGUMENTS`
