# Component i18n Example

## Complete Example: Invoice Summary Component

This example demonstrates all i18n patterns in a single component.

### Before (Anti-Patterns)

```tsx
// ❌ WRONG: Multiple i18n anti-patterns
function InvoiceSummary({ invoice }) {
  const items = invoice.items.map(i => i.name);
  const dueDate = new Date(invoice.dueDate);
  
  console.log('Rendering invoice:', invoice.id); // ❌ console.log
  
  return (
    <div>
      <h2>Invoice Summary</h2> {/* ❌ Hardcoded string */}
      <p>Total: ₪{invoice.total.toFixed(2)}</p> {/* ❌ Hardcoded currency */}
      <p>Items: {items.join(', ')}</p> {/* ❌ .join() for list */}
      <p>Due: {dueDate.toLocaleDateString('he-IL')}</p> {/* ❌ Raw Date */}
      <p>
        {invoice.itemCount === 1 ? '1 item' : `${invoice.itemCount} items`} {/* ❌ Inline plural */}
      </p>
      <p>Position: {invoice.priority}st</p> {/* ❌ Hardcoded ordinal */}
    </div>
  );
}
```

### After (Correct Patterns)

```tsx
// ✅ CORRECT: All i18n patterns properly implemented
import { useTranslation, Trans } from 'react-i18next';
import { useFormatting } from '@/hooks';
import { formatDate } from '@/lib/dates';

function InvoiceSummary({ invoice }) {
  const { t } = useTranslation('invoices');
  const { formatILS, formatList, formatOrdinal } = useFormatting();
  
  const itemNames = invoice.items.map(i => i.name);
  
  return (
    <div>
      <h2>{t('summary.title')}</h2>
      
      {/* Currency formatting */}
      <p>{t('summary.total')}: {formatILS(invoice.total)}</p>
      
      {/* List formatting */}
      <p>{t('summary.items')}: {formatList(itemNames)}</p>
      
      {/* Date formatting */}
      <p>{t('summary.dueDate')}: {formatDate(invoice.dueDate)}</p>
      
      {/* ICU plural (in translation file) */}
      <p>{t('summary.itemCount', { count: invoice.itemCount })}</p>
      
      {/* Ordinal formatting */}
      <p>{t('summary.priority')}: {formatOrdinal(invoice.priority)}</p>
      
      {/* Rich text with Trans */}
      <Trans
        i18nKey="invoices:summary.paymentNote"
        values={{ amount: formatILS(invoice.total) }}
        components={{ bold: <strong className="font-semibold" /> }}
      />
    </div>
  );
}
```

### Translation Files

**en/invoices.json:**
```json
{
  "summary": {
    "title": "Invoice Summary",
    "total": "Total",
    "items": "Items",
    "dueDate": "Due Date",
    "itemCount": "{count, plural, =0 {No items} one {# item} other {# items}}",
    "priority": "Priority",
    "paymentNote": "Please pay <bold>{{amount}}</bold> by the due date."
  }
}
```

**he/invoices.json:**
```json
{
  "summary": {
    "title": "סיכום חשבונית",
    "total": "סה״כ",
    "items": "פריטים",
    "dueDate": "תאריך יעד",
    "itemCount": "{count, plural, =0 {אין פריטים} one {פריט #} two {# פריטים} other {# פריטים}}",
    "priority": "עדיפות",
    "paymentNote": "אנא שלם <bold>{{amount}}</bold> עד תאריך היעד."
  }
}
```

---

## Pattern Summary

| Pattern | Wrong | Correct |
|---------|-------|---------|
| Strings | `"Invoice"` | `t('invoices:title')` |
| Currency | `₪${total}` | `formatILS(total)` |
| Lists | `items.join(', ')` | `formatList(items)` |
| Dates | `date.toLocaleDateString()` | `formatDate(date)` |
| Plurals | `count === 1 ? 'item' : 'items'` | `t('key', { count })` |
| Ordinals | `${n}st` | `formatOrdinal(n)` |
| Rich text | String concat with JSX | `<Trans>` component |
| Debug | `console.log()` | Remove before commit |

---

**Last Updated**: 2026-01-06
