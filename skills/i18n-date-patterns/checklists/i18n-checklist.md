# i18n Implementation Checklist

Use this checklist when adding or reviewing i18n in the application components.

---

## New Component Checklist

### UI Strings

- [ ] Import `useTranslation` from `react-i18next`
- [ ] All visible text uses `t('namespace:key')` function
- [ ] No hardcoded Hebrew strings (e.g., `מטופלים`)
- [ ] No hardcoded English strings (e.g., `Save`, `Cancel`)
- [ ] Translation keys added to both `en/*.json` and `he/*.json`
- [ ] Key naming follows convention: `category.subcategory.action`

### Formatting

- [ ] Import `useFormatting` from `@/hooks` for locale-aware data
- [ ] Currency uses `formatILS()` not `₪${price}`
- [ ] Lists use `formatList()` not `.join(', ')`
- [ ] Ordinals use `formatOrdinal()` not hardcoded suffixes
- [ ] Percentages use `formatPercent()` not `${n}%`

### Dates & Times

- [ ] Import from `@/lib/dates`, not `dayjs` directly
- [ ] No `new Date().toLocaleDateString()`
- [ ] No hardcoded date formats (e.g., `DD/MM/YYYY`)
- [ ] Use appropriate helper: `formatDate`, `formatDateShort`, `formatFullDate`
- [ ] Wait times use `calculateWaitTime()`

### Pluralization

- [ ] Complex plurals use ICU MessageFormat in translation files
- [ ] No conditional ternary logic for plural forms in code
- [ ] Hebrew dual forms (two) handled when applicable
- [ ] All plural keys include `other` case

### Rich Text

- [ ] Embedded components use `<Trans>` component
- [ ] No string concatenation with JSX
- [ ] No `dangerouslySetInnerHTML` for translated content

### RTL Support

- [ ] Component respects `isRTL` for directional styling
- [ ] Text alignment adapts to locale
- [ ] Icons/arrows flip appropriately in RTL

---

## Code Review Checklist

### Forbidden Patterns

- [ ] ❌ No `.join(', ')` for user-facing lists
- [ ] ❌ No `console.log` statements in production code
- [ ] ❌ No hardcoded currency symbols (`₪`, `$`)
- [ ] ❌ No `new Date()` for formatting
- [ ] ❌ No inline locale strings (`דקות`, `minutes`)
- [ ] ❌ No conditional pluralization in code

### Required Patterns

- [ ] ✅ `useTranslation` hook present
- [ ] ✅ `useFormatting` hook for locale-sensitive data
- [ ] ✅ All translation keys exist in both locales
- [ ] ✅ Component tested with language switch

---

## Migration Checklist (Existing Component)

When updating a component to use proper i18n:

1. [ ] Identify all hardcoded strings
2. [ ] Create translation keys in appropriate namespace
3. [ ] Add translations to `en/*.json` and `he/*.json`
4. [ ] Replace hardcoded strings with `t()` calls
5. [ ] Replace `.join()` with `formatList()`
6. [ ] Replace date formatting with `@/lib/dates` helpers
7. [ ] Replace currency with `formatILS()`
8. [ ] Remove any `console.log` statements
9. [ ] Test language switching
10. [ ] Test RTL layout (if applicable)

---

## Quality Metrics

| Metric | Target | How to Check |
|--------|--------|--------------|
| Components with `useTranslation` | 100% | `grep -r "useTranslation" --include="*.tsx"` |
| Components with `useFormatting` | 80%+ | `grep -r "useFormatting" --include="*.tsx"` |
| Console.log statements | 0 | `grep -r "console.log" --include="*.tsx"` |
| Hardcoded `.join()` | 0 | `grep -r "\.join(" --include="*.tsx"` |
| Raw `dayjs().format()` | 0 | `grep -r "dayjs().format" --include="*.tsx"` |

---

**Last Updated**: 2026-01-06
