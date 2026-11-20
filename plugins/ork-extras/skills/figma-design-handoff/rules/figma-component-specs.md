---
title: "Figma Component Spec Extraction"
impact: "HIGH"
impactDescription: "Without structured component specs, developers guess at prop types, miss variant states, and implement incomplete component APIs."
tags: [figma-components, component-specs, typescript-interfaces, variants, design-handoff]
---

## Figma Component Spec Extraction

Figma components with variants and properties must be documented as TypeScript interfaces. Each Figma component property (variant, boolean, text, instance swap) maps to a typed prop.

**Incorrect:**
```typescript
// Vague props guessed from a screenshot
interface ButtonProps {
  type: string;    // What values? No idea
  big: boolean;    // Naming doesn't match design
  children: any;   // No slot documentation
}
```

**Correct:**
```typescript
// Props derived from Figma component properties
interface ButtonProps {
  /** Figma variant: "Variant" */
  variant: 'primary' | 'secondary' | 'ghost' | 'destructive';
  /** Figma variant: "Size" */
  size: 'sm' | 'md' | 'lg';
  /** Figma boolean: "Show Icon" */
  showIcon?: boolean;
  /** Figma instance swap: "Icon" */
  icon?: React.ComponentType<{ className?: string }>;
  /** Figma text: "Label" */
  children: React.ReactNode;
  /** Figma boolean: "Disabled" */
  disabled?: boolean;
  /** Figma boolean: "Loading" */
  loading?: boolean;
}
```

**Extracting specs from Figma REST API:**
```typescript
const components = await fetch(
  `https://api.figma.com/v1/files/${fileKey}/component_sets`,
  { headers: { 'X-Figma-Token': token } }
);

// Each component set contains:
// - componentPropertyDefinitions: variant props + types
// - children: individual variant combinations
for (const [id, set] of Object.entries(components.meta.component_sets)) {
  const props = set.componentPropertyDefinitions;
  // VARIANT → union type of allowed values
  // BOOLEAN → optional boolean prop
  // TEXT → string / ReactNode prop
  // INSTANCE_SWAP → component type prop
}
```

**Key rules:**
- Map every Figma component property to a TypeScript prop — no guessing from visuals
- Figma variant properties become string union types with exact value names
- Figma boolean properties become optional boolean props
- Figma text properties become string or ReactNode props
- Figma instance swap properties become component type props
- Document all interactive states (hover, focus, active, disabled, loading)
- Include the Figma component URL in JSDoc for traceability
- Keep prop names consistent with Figma property names (convert to camelCase)

Reference: [Figma Component Properties API](https://www.figma.com/developers/api#component-sets)
