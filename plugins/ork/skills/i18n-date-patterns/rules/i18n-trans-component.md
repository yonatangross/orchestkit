---
title: Use the Trans component for JSX-embedded translations that preserve locale word order
category: i18n
impact: HIGH
impactDescription: "Splitting translations around JSX elements breaks word order in non-English locales and tempts developers toward dangerouslySetInnerHTML"
tags: [i18n, react, trans, jsx, react-i18next]
---

## i18n: Trans Component

The `<Trans>` component from `react-i18next` embeds React elements (links, bold, icons) inside translated strings. Without it, developers split translations around JSX — breaking word order in other locales — or resort to `dangerouslySetInnerHTML`, which introduces XSS vulnerabilities.

### Never concatenate translated strings with JSX between them

**Incorrect:**
```tsx
// Splitting translation around JSX — word order breaks in RTL/other locales
<p>{t('welcome')} <strong>{userName}</strong> {t('toDashboard')}</p>
```

**Correct:**
```tsx
import { Trans } from 'react-i18next';

// Translation: "Welcome <strong>{{name}}</strong> to the dashboard!"
<Trans
  i18nKey="welcomeUser"
  values={{ name: userName }}
  components={{ strong: <strong className="font-bold" /> }}
/>
```

### Never use dangerouslySetInnerHTML for rich translated text

**Incorrect:**
```tsx
<p dangerouslySetInnerHTML={{ __html: t('richContent') }} /> // XSS risk!
```

**Correct:**
```tsx
<Trans i18nKey="richContent" components={{ bold: <strong />, link: <a href="/help" /> }} />
```

### Prefer named components over indexed tags

**Incorrect:**
```tsx
// Indexed tags — fragile, order-dependent
// Translation: "Click <0>here</0> to <1>learn more</1>."
<Trans i18nKey="simple" components={[
  <a href="/action" />, <span className="font-bold" />
]} />
```

**Correct:**
```tsx
// Named tags — self-documenting, order-independent
// Translation: "Click <link>here</link> to <bold>learn more</bold>."
<Trans i18nKey="simple" components={{
  link: <a href="/action" />,
  bold: <span className="font-bold" />
}} />
```

**Key rules:**
- Never split a sentence across multiple `t()` calls with JSX between them — use a single `<Trans>` with `components` mapping
- Never use `dangerouslySetInnerHTML` for rich translated text — `<Trans>` provides safe component interpolation
- Prefer named component tags (`<link>`, `<bold>`) over indexed tags (`<0>`, `<1>`) in translation strings
- Use `t()` for plain text and `<Trans>` only when JSX elements must appear inside the translated string

Reference: `references/trans-component.md` (lines 23-38, 207-235)
