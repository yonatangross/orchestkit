---
title: Avoid hardcoded date and number formats that break in non-English locales
category: i18n
impact: CRITICAL
impactDescription: "Hardcoded formats and string concatenation break when locale changes, producing garbled UI for non-English users"
tags: [i18n, formatting, locale, currency, lists]
---

## i18n: Formatting Anti-Patterns

String concatenation, hardcoded currency symbols, manual list joining, and direct `toLocaleString` calls bypass the locale-aware formatting layer. These patterns silently break in RTL languages, produce incorrect currency symbols, and ignore locale-specific list conjunction rules.

### Never concatenate or interpolate raw values into user-facing strings

**Incorrect:**
```tsx
// String concatenation — breaks word order in RTL locales
const greeting = "Hello " + userName + "!";

// Template literal — same problem, locale-unaware
const message = `Welcome ${userName} to the dashboard`;

// Hardcoded currency symbol — wrong for non-ILS locales
<p>Price: ₪{price}</p>
<p>Total: ${price.toFixed(2)}</p>
```

**Correct:**
```tsx
import { useTranslation } from 'react-i18next';
import { useFormatting } from '@/hooks';

const { t } = useTranslation();
const { formatILS } = useFormatting();

// Translation key handles word order per locale
<p>{t('greeting', { name: userName })}</p>
// Locale-aware currency formatting
<p>{t('price_label')}: {formatILS(price)}</p>
```

### Never use `.join()` for user-facing lists

**Incorrect:**
```tsx
const pets = ['Max', 'Bella', 'Charlie'];
// English-only comma joining — Hebrew uses "ו-" as conjunction
<p>Pets: {pets.join(', ')}</p>
```

**Correct:**
```tsx
const { formatList } = useFormatting();
// Produces "Max, Bella, and Charlie" (en) or "מקס, בלה ו-צ'רלי" (he)
<p>Pets: {formatList(pets)}</p>
```

### Never call `toLocaleString` directly

**Incorrect:**
```tsx
// Hardcodes locale string, bypasses app-wide locale setting
const formatted = number.toLocaleString('he-IL');
```

**Correct:**
```tsx
const { formatNumber } = useFormatting();
// Automatically uses the app's current locale
const formatted = formatNumber(number);
```

**Key rules:**
- Use `t('key', { variable })` with ICU MessageFormat placeholders instead of string concatenation or template literals
- Use `useFormatting()` hooks (`formatILS`, `formatList`, `formatNumber`, `formatPercent`) instead of hardcoded symbols or manual formatting
- Never call `.join()` on arrays for user-facing list display — use `formatList()` or `formatListOr()` which handle locale-specific conjunctions
- Never call `toLocaleString()` directly — it bypasses the app's locale management and cannot react to language changes

Reference: `references/formatting-utilities.md` (lines 132-167)
