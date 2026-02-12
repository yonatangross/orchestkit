---
name: create-page-object
description: Create Playwright page object with auto-detected existing patterns. Use when creating E2E test page objects.
user-invocable: true
argument-hint: [page-name]
---

Create page object: $ARGUMENTS

## Page Object Context (Auto-Detected)

- **Existing Page Objects**: !`find tests/e2e/pages tests/__tests__ -name "*Page.ts" -o -name "*Page.tsx" 2>/dev/null | wc -l | tr -d ' ' || echo "0"`
- **Test Directory**: !`find . -type d \( -name "tests" -o -name "__tests__" -o -name "e2e" \) 2>/dev/null | head -1 || echo "tests/e2e"`
- **Playwright Version**: !`grep -r "@playwright/test" package.json 2>/dev/null | head -1 | grep -oE '@playwright/test[^"]*' || echo "Not detected"`
- **Existing Patterns**: !`grep -r "getByRole\|getByLabel" tests/e2e/pages 2>/dev/null | head -3 || echo "No existing patterns found"`

## Page Object Template

```typescript
/**
 * $ARGUMENTS Page Object
 * 
 * Generated: !`date +%Y-%m-%d`
 * Test Directory: !`find . -type d \( -name "tests" -o -name "e2e" \) 2>/dev/null | head -1 || echo "tests/e2e"`
 */

import { Page, Locator, expect } from '@playwright/test';

export class $ARGUMENTS {
  // Locators
  private readonly heading: Locator;
  private readonly form: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading');
    this.form = page.getByRole('form');
  }

  async goto() {
    await this.page.goto('/$ARGUMENTS');
    await this.waitForLoad();
  }

  async waitForLoad() {
    await expect(this.heading).toBeVisible();
  }
}
```

## Usage

1. Review detected patterns above
2. Save to: `tests/e2e/pages/$ARGUMENTS.ts`
3. Use in tests: `const page = new $ARGUMENTS(page);`
