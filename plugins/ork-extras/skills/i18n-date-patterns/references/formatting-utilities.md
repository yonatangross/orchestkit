# Formatting Utilities Reference

## Overview

This reference documents the `useFormatting` hook and related formatting utilities for locale-aware data display in the application React components.

**Primary Source:** `frontend/src/hooks/useFormatting.ts`
**Implementation:** `frontend/src/lib/formatting.ts`
**Standards Doc:** `docs/i18n-standards.md`

---

## useFormatting Hook

The `useFormatting` hook provides locale-aware formatting functions that automatically re-render when the language changes.

### Basic Usage

```tsx
import { useFormatting } from '@/hooks';

function MyComponent() {
  const {
    formatILS,
    formatList,
    formatListOr,
    formatOrdinal,
    formatDuration,
    formatRelativeTime,
    formatPercent,
    formatWeight,
    isRTL,
    locale
  } = useFormatting();

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <p>Price: {formatILS(1500)}</p>
      <p>Pets: {formatList(['Max', 'Bella', 'Charlie'])}</p>
      <p>Position: {formatOrdinal(3)}</p>
    </div>
  );
}
```

---

## Available Formatters

### Currency Formatting

| Function | Purpose | Hebrew Output | English Output |
|----------|---------|---------------|----------------|
| `formatILS(amount)` | Israeli Shekel with locale | `₪1,234.56` | `$1,234.56` |
| `formatCurrency(amount, code)` | Any currency | Varies | Varies |

```tsx
formatILS(1500)      // → "₪1,500.00" (he) / "$1,500.00" (en)
formatCurrency(99.99, 'EUR') // → "€99.99"
```

### Number Formatting

| Function | Purpose | Example |
|----------|---------|---------|
| `formatNumber(n)` | Locale-aware number | `1,234.56` |
| `formatPercent(n)` | Percentage | `85%` |
| `formatCompact(n)` | Compact notation | `1.5K` |
| `formatWeight(n)` | Weight with units | `5.5 kg` / `5.5 ק"ג` |
| `formatDecimal(n, places)` | Fixed decimal places | `3.14` |

```tsx
formatPercent(0.85)   // → "85%"
formatCompact(1500)   // → "1.5K"
formatWeight(5.5)     // → "5.5 kg" (en) / '5.5 ק"ג' (he)
```

### List Formatting

| Function | Purpose | Hebrew Output | English Output |
|----------|---------|---------------|----------------|
| `formatList(items)` | "and" conjunction | `א, ב ו-ג` | `a, b, and c` |
| `formatListOr(items)` | "or" conjunction | `א, ב או ג` | `a, b, or c` |
| `formatListUnits(items)` | Unit list | `א, ב, ג` | `a, b, c` |

```tsx
formatList(['Max', 'Bella', 'Charlie'])
// → "Max, Bella, and Charlie" (en)
// → "מקס, בלה ו-צ'רלי" (he)

formatListOr(['dog', 'cat'])
// → "dog or cat" (en)
// → "כלב או חתול" (he)
```

### Time Formatting

| Function | Purpose | Example |
|----------|---------|---------|
| `formatRelativeTime(date)` | Time ago/until | `2 days ago` |
| `formatTimeUntil(date)` | Time until future | `in 3 hours` |
| `formatTimeSince(date)` | Time since past | `5 minutes ago` |
| `formatDuration(seconds)` | Human-readable duration | `1 hr 30 min` |
| `formatDurationClock(seconds)` | Clock format | `01:30:00` |

```tsx
formatRelativeTime(yesterday)  // → "yesterday" / "אתמול"
formatDuration(3661)           // → "1 hr 1 min 1 sec"
```

### Ordinal Formatting

| Function | Purpose | Hebrew Output | English Output |
|----------|---------|---------------|----------------|
| `formatOrdinal(n)` | Ordinal number | `3.` | `3rd` |
| `formatPosition(n)` | Position label | `מקום 3` | `3rd place` |

```tsx
formatOrdinal(1)   // → "1st" (en) / "1." (he)
formatOrdinal(3)   // → "3rd" (en) / "3." (he)
formatOrdinal(22)  // → "22nd" (en) / "22." (he)
```

### Date Range Formatting

| Function | Purpose | Example |
|----------|---------|---------|
| `formatDateRange(start, end)` | Date range | `Jan 5 – 10, 2026` |

---

## Anti-Patterns

### ❌ NEVER use `.join()` for user-facing lists

```tsx
// ❌ WRONG
const pets = ['Max', 'Bella', 'Charlie'];
<p>Pets: {pets.join(', ')}</p>

// ✅ CORRECT
const { formatList } = useFormatting();
<p>Pets: {formatList(pets)}</p>
```

### ❌ NEVER hardcode currency symbols

```tsx
// ❌ WRONG
<p>Price: ₪{price}</p>
<p>Price: ${price.toFixed(2)}</p>

// ✅ CORRECT
const { formatILS } = useFormatting();
<p>Price: {formatILS(price)}</p>
```

### ❌ NEVER use toLocaleString directly

```tsx
// ❌ WRONG
const formatted = number.toLocaleString('he-IL');

// ✅ CORRECT
const { formatNumber } = useFormatting();
const formatted = formatNumber(number);
```

---

## Integration with useTranslation

The `useFormatting` hook complements `useTranslation`:

```tsx
import { useTranslation } from 'react-i18next';
import { useFormatting } from '@/hooks';

function InvoiceSummary({ total, items }) {
  const { t } = useTranslation('invoices');
  const { formatILS, formatList } = useFormatting();

  return (
    <div>
      <h2>{t('summary.title')}</h2>
      <p>{t('summary.total')}: {formatILS(total)}</p>
      <p>{t('summary.items')}: {formatList(items.map(i => i.name))}</p>
    </div>
  );
}
```

---

## Locale Properties

```tsx
const { locale, isRTL } = useFormatting();

// locale: 'he-IL' | 'en-US'
// isRTL: true (Hebrew) | false (English)
```

---

**Last Updated**: 2026-01-06
