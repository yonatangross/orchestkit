---
name: create-form
description: Create React form with auto-detected form library and patterns. Use when creating forms.
user-invocable: true
argument-hint: [form-name]
---

Create form: $ARGUMENTS

## Form Context (Auto-Detected)

- **Form Library**: !`grep -r "react-hook-form\|formik" package.json 2>/dev/null | head -1 | grep -oE 'react-hook-form|formik' || echo "react-hook-form (recommended)"`
- **Validation Library**: !`grep -r "zod\|yup" package.json 2>/dev/null | head -1 | grep -oE 'zod|yup' || echo "zod (recommended)"`
- **Existing Forms**: !`find . -name "*form*.tsx" -o -name "*Form*.tsx" 2>/dev/null | wc -l | tr -d ' ' || echo "0"`
- **Components Directory**: !`find . -type d \( -name "components" -o -name "src/components" \) 2>/dev/null | head -1 || echo "components"`

## Form Template

```typescript
/**
 * $ARGUMENTS Form
 * 
 * Generated: !`date +%Y-%m-%d`
 * Library: !`grep -r "react-hook-form" package.json 2>/dev/null && echo "react-hook-form" || echo "react-hook-form (install: npm install react-hook-form)"`
 */

'use client';

import { useForm } from 'react-hook-form';
!`grep -q "zod" package.json 2>/dev/null && echo "import { zodResolver } from '@hookform/resolvers/zod';" || echo "// Install: npm install @hookform/resolvers zod"`
!`grep -q "zod" package.json 2>/dev/null && echo "import { z } from 'zod';" || echo "// Install: npm install zod"`

!`grep -q "zod" package.json 2>/dev/null && echo "const schema = z.object({
  // Add your fields here
});" || echo "// Define your schema"`

export function $ARGUMENTS() {
  const form = useForm({
    !`grep -q "zod" package.json 2>/dev/null && echo "resolver: zodResolver(schema)," || echo "// Add resolver if using zod"`
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Add form fields */}
    </form>
  );
}
```

## Usage

1. Review detected libraries above
2. Save to: `components/forms/$ARGUMENTS.tsx`
3. Customize schema and fields
