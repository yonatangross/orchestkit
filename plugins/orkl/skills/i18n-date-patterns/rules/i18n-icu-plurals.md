---
title: Use ICU plural rules to handle complex plural forms across all locales correctly
category: i18n
impact: HIGH
impactDescription: "Hardcoded plural logic fails for locales with complex plural forms (Arabic has 6, Hebrew has dual), producing grammatically incorrect text"
tags: [i18n, icu, pluralization, messageformat]
---

## i18n: ICU Plural Rules

ICU MessageFormat provides locale-aware pluralization via `{variable, plural, ...}` syntax in translation files. Hardcoding plural logic in JavaScript with ternaries or conditionals only works for English (`one`/`other`) and breaks for languages with more plural categories — Hebrew has a dual form, Arabic has six forms (zero, one, two, few, many, other).

### Never use conditional logic in code for plurals

**Incorrect:**
```tsx
// Ternary pluralization — only handles English
const message = count === 0
  ? 'No items'
  : count === 1
    ? '1 item'
    : `${count} items`;

// Conditional with template literal — same problem
const label = `${count} patient${count !== 1 ? 's' : ''}`;
```

**Correct:**
```tsx
// Translation file (en.json):
// "items": "{count, plural, =0 {No items} one {# item} other {# items}}"
// "patients": "{count, plural, =0 {No patients} one {# patient} other {# patients}}"

import { useTranslation } from 'react-i18next';

function PatientCount({ count }) {
  const { t } = useTranslation();
  // ICU handles plural category selection per locale
  return <span>{t('patients', { count })}</span>;
}
```

### Always include the `other` category

Every ICU plural message MUST include the `other` case. It is the mandatory fallback category used by all locales. Omitting it causes runtime errors or blank output for unmatched counts.

**Incorrect:**
```json
{
  "items": "{count, plural, =0 {None} one {One item}}"
}
```

**Correct:**
```json
{
  "items": "{count, plural, =0 {None} one {One item} other {# items}}"
}
```

### Handle locale-specific plural categories and `=0` for zero states

Hebrew uses a `two` (dual) form. Arabic uses `zero`, `one`, `two`, `few`, `many`, and `other`. The `=0` exact-match takes priority over the `zero` category and works across all locales.

```json
// Hebrew (he.json) — includes dual form:
{ "items": "{count, plural, =0 {אין פריטים} one {פריט #} two {# פריטים} other {# פריטים}}" }

// English — use =0 for empty states:
{ "appointments": "{count, plural, =0 {No upcoming appointments} one {# appointment} other {# appointments}}" }
```

**Key rules:**
- Never use ternaries, conditionals, or template literals for pluralization — always use ICU `{count, plural, ...}` in translation files
- Every `plural` message must include the `other` category as a mandatory fallback
- Provide locale-specific categories (`two` for Hebrew, `few`/`many` for Arabic, Slavic languages) in the respective translation files
- Use `=0` exact match for zero/empty states instead of relying on the `zero` plural category

Reference: `references/icu-messageformat.md` (lines 13-28, 141-165)
