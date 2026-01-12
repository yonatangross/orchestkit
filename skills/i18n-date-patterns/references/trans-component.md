# Trans Component Reference

## Overview

The `<Trans>` component from `react-i18next` enables embedding React components within translated text. Use this for rich text formatting, links, and interactive elements.

---

## Basic Usage

### Translation File

```json
{
  "richText": {
    "welcome": "Welcome <strong>{{name}}</strong> to the application!",
    "terms": "By continuing, you agree to our <link>Terms of Service</link>.",
    "highlight": "Your pet <bold>{{petName}}</bold> has <count>{{count}}</count> upcoming appointments."
  }
}
```

### Component Usage

```tsx
import { Trans } from 'react-i18next';

function WelcomeMessage({ userName }) {
  return (
    <Trans
      i18nKey="richText.welcome"
      values={{ name: userName }}
      components={{ strong: <strong className="font-bold" /> }}
    />
  );
}
// Output: Welcome <strong>John</strong> to the application!
```

---

## Component Mapping

### Named Components

```tsx
<Trans
  i18nKey="richText.terms"
  components={{
    link: <a href="/terms" className="text-primary underline" />
  }}
/>
```

### Multiple Components

```tsx
<Trans
  i18nKey="richText.highlight"
  values={{ petName: 'Max', count: 3 }}
  components={{
    bold: <strong className="font-semibold" />,
    count: <span className="text-primary font-bold" />
  }}
/>
```

---

## Self-Closing Tags

For components without children (icons, line breaks):

### Translation File

```json
{
  "withIcon": "Click here <icon/> to continue",
  "multiLine": "Line one<br/>Line two"
}
```

### Component Usage

```tsx
import { AlertCircle } from 'lucide-react';

<Trans
  i18nKey="withIcon"
  components={{
    icon: <AlertCircle className="inline h-4 w-4" />
  }}
/>

<Trans
  i18nKey="multiLine"
  components={{
    br: <br />
  }}
/>
```

---

## Indexed Components

For simpler cases, use indexed tags:

### Translation File

```json
{
  "simple": "Click <0>here</0> to <1>learn more</1>."
}
```

### Component Usage

```tsx
<Trans
  i18nKey="simple"
  components={[
    <a href="/action" className="text-primary" />,
    <span className="font-bold" />
  ]}
/>
```

---

## With Interpolation

Combine values and components:

```tsx
<Trans
  i18nKey="message"
  values={{
    name: user.name,
    date: formattedDate
  }}
  components={{
    bold: <strong />,
    link: <Link to="/profile" />
  }}
/>
```

---

## Pluralization with Trans

```json
{
  "petCount": "{count, plural, =0 {You have <bold>no pets</bold>} one {You have <bold># pet</bold>} other {You have <bold># pets</bold>}}"
}
```

```tsx
<Trans
  i18nKey="petCount"
  values={{ count: petCount }}
  components={{ bold: <strong /> }}
/>
```

---

## Common Patterns for the application

### Highlighted Pet Names

```json
{
  "visitSummary": "Visit summary for <petName>{{name}}</petName>"
}
```

```tsx
<Trans
  i18nKey="visitSummary"
  values={{ name: pet.name }}
  components={{
    petName: <span className="font-semibold text-primary" />
  }}
/>
```

### Action Links

```json
{
  "addPet": "Don't see your pet? <addLink>Add a new pet</addLink>"
}
```

```tsx
<Trans
  i18nKey="addPet"
  components={{
    addLink: <button onClick={onAddPet} className="text-primary underline" />
  }}
/>
```

---

## Anti-Patterns

### ❌ NEVER concatenate translated strings with JSX

```tsx
// ❌ WRONG
<p>
  {t('welcome')} <strong>{userName}</strong> {t('tothe application')}
</p>

// ✅ CORRECT
<Trans
  i18nKey="welcomeUser"
  values={{ name: userName }}
  components={{ strong: <strong /> }}
/>
```

### ❌ NEVER use dangerouslySetInnerHTML for rich text

```tsx
// ❌ WRONG (security risk!)
<p dangerouslySetInnerHTML={{ __html: t('richContent') }} />

// ✅ CORRECT
<Trans i18nKey="richContent" components={{ ... }} />
```

---

## TypeScript Support

```tsx
import { Trans, TransProps } from 'react-i18next';

// Type-safe component props
const transProps: TransProps<string> = {
  i18nKey: 'myKey',
  values: { name: 'John' },
  components: { bold: <strong /> }
};
```

---

**Last Updated**: 2026-01-06
