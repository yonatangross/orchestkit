---
title: Create separate registries per platform sharing a single catalog
impact: HIGH
impactDescription: "One giant registry for all platforms fails because PDF uses View/Text, web uses div/span, email uses Section/Text — they are incompatible"
tags: [registry, catalog, mapping, platform, type-safety, react-pdf, react-email]
---

## Registry Mapping

A registry maps each catalog type to a platform-specific component implementation. The catalog (Zod schemas) and spec (flat-tree data) stay identical across surfaces. Only the registry changes.

**Incorrect — one giant registry trying to cover all platforms:**
```typescript
// WRONG: Impossible — PDF needs View/Text, web needs div/span
const universalRegistry = {
  Heading: ({ text, level, platform }) => {
    if (platform === 'pdf') return <Text style={...}>{text}</Text>
    if (platform === 'email') return <Heading as={level}>{text}</Heading>
    return <h1>{text}</h1> // web fallback
  },
}
```

**Correct — separate registries per platform, same catalog:**
```typescript
import { catalog } from './catalog' // SHARED — one definition

// Web registry
export const webRegistry = {
  Heading: ({ text, level }) => {
    const Tag = level
    return <Tag className="font-bold tracking-tight">{text}</Tag>
  },
  StatCard: ({ label, value, trend }) => (
    <div className="rounded-lg border p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {trend && <TrendIcon direction={trend} />}
    </div>
  ),
}

// PDF registry
import { View, Text } from '@react-pdf/renderer'
export const pdfRegistry = {
  Heading: ({ text, level }) => (
    <Text style={{ fontSize: level === 'h1' ? 24 : 18, fontWeight: 'bold' }}>
      {text}
    </Text>
  ),
  StatCard: ({ label, value }) => (
    <View style={{ border: '1pt solid #ccc', padding: 8 }}>
      <Text style={{ fontSize: 10, color: '#666' }}>{label}</Text>
      <Text style={{ fontSize: 18 }}>{value}</Text>
    </View>
  ),
}

// Email registry
import { Section, Text as EmailText, Heading as EmailHeading } from '@react-email/components'
export const emailRegistry = {
  Heading: ({ text, level }) => (
    <EmailHeading as={level}>{text}</EmailHeading>
  ),
  StatCard: ({ label, value }) => (
    <Section style={{ border: '1px solid #e5e7eb', padding: '12px' }}>
      <EmailText style={{ fontSize: '12px', color: '#6b7280' }}>{label}</EmailText>
      <EmailText style={{ fontSize: '20px', fontWeight: 'bold' }}>{value}</EmailText>
    </Section>
  ),
}
```

**Key rules:**
- One catalog, many registries — the catalog defines WHAT can be rendered, registries define HOW
- Every catalog type must have an entry in each registry — missing entries throw at render time
- Registry components receive the same props defined in the catalog Zod schema
- Never add platform-specific props to the catalog — the catalog is platform-agnostic
- Organize registries in `./registries/web.ts`, `./registries/pdf.ts`, `./registries/email.ts`
- Use `CatalogComponents<typeof catalog>` type to ensure registries match the catalog

### Type-Safe Registry Pattern

```typescript
import type { CatalogComponents } from '@json-render/react'
import type { catalog } from './catalog'

// TypeScript ensures every catalog type is implemented
export const webRegistry: CatalogComponents<typeof catalog> = {
  Heading: ({ text, level }) => { /* ... */ },
  StatCard: ({ label, value, trend }) => { /* ... */ },
  // Missing type → TypeScript error
}
```

### File Organization

```
src/
  catalog.ts              # Shared catalog (Zod schemas)
  registries/
    web.ts                # React/HTML components
    pdf.ts                # react-pdf View/Text components
    email.ts              # react-email Section/Text components
    image.ts              # Satori-compatible inline-style components
    remotion.ts           # Remotion-animated components
```
