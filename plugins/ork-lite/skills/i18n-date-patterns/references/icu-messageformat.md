# ICU MessageFormat Reference

## Overview

ICU MessageFormat provides advanced pluralization and selection logic in translation files. the application uses `i18next-icu` for ICU support.

**Dependencies:**
- `i18next-icu v2.4.1`
- ICU MessageFormat syntax

---

## Plural Rules

### Basic Plural

```json
{
  "patients": "{count, plural, =0 {No patients} one {# patient} other {# patients}}"
}
```

Usage:
```tsx
t('patients', { count: 0 })  // → "No patients"
t('patients', { count: 1 })  // → "1 patient"
t('patients', { count: 5 })  // → "5 patients"
```

### Hebrew Plural (with dual form)

Hebrew has special forms for dual (two) numbers:

```json
{
  "items": "{count, plural, =0 {אין פריטים} one {פריט #} two {# פריטים} other {# פריטים}}"
}
```

### Offset Plurals

```json
{
  "guests": "{count, plural, offset:1 =0 {No guests} =1 {One guest} one {# guests and one other} other {# guests and # others}}"
}
```

---

## Select Rules

For non-numeric selection (gender, type, etc.):

```json
{
  "petGreeting": "{species, select, dog {Good boy!} cat {Nice kitty!} other {Hello pet!}}"
}
```

Usage:
```tsx
t('petGreeting', { species: 'dog' })  // → "Good boy!"
t('petGreeting', { species: 'cat' })  // → "Nice kitty!"
t('petGreeting', { species: 'bird' }) // → "Hello pet!"
```

---

## Ordinal Rules

```json
{
  "position": "{position, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}"
}
```

Usage:
```tsx
t('position', { position: 1 })  // → "1st"
t('position', { position: 2 })  // → "2nd"
t('position', { position: 3 })  // → "3rd"
t('position', { position: 4 })  // → "4th"
```

---

## Number Formatting in ICU

```json
{
  "price": "The price is {amount, number, ::currency/ILS}"
}
```

---

## Date Formatting in ICU

```json
{
  "appointment": "Your appointment is on {date, date, medium}"
}
```

---

## Nested Messages

Combine plural and select:

```json
{
  "petStatus": "{species, select, dog {{count, plural, =0 {No dogs} one {# dog} other {# dogs}}} cat {{count, plural, =0 {No cats} one {# cat} other {# cats}}} other {{count, plural, =0 {No pets} one {# pet} other {# pets}}}}"
}
```

---

## Common Patterns for the application

### Counts with Zero State

```json
{
  "vaccinations": "{count, plural, =0 {No vaccinations recorded} one {# vaccination} other {# vaccinations}}",
  "medications": "{count, plural, =0 {No active medications} one {# medication} other {# medications}}",
  "appointments": "{count, plural, =0 {No upcoming appointments} one {# appointment} other {# appointments}}"
}
```

### Time Remaining

```json
{
  "daysRemaining": "{count, plural, =0 {Due today} one {# day remaining} other {# days remaining}}"
}
```

---

## Anti-Patterns

### ❌ NEVER use conditional logic in code for plurals

```tsx
// ❌ WRONG
const message = count === 0 ? 'No items' : count === 1 ? '1 item' : `${count} items`;

// ✅ CORRECT
const message = t('items', { count });
```

### ❌ NEVER forget the "other" case

```json
// ❌ WRONG - missing "other"
{
  "items": "{count, plural, =0 {None} one {One}}"
}

// ✅ CORRECT
{
  "items": "{count, plural, =0 {None} one {One} other {#}}"
}
```

---

**Last Updated**: 2026-01-06
