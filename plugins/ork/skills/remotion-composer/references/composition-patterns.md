# Composition Patterns

## Basic Composition

```tsx
import { Composition } from "remotion";
import { HybridDemo, hybridDemoSchema } from "./components/HybridDemo";

<Composition
  id="SkillNameDemo"
  component={HybridDemo}
  durationInFrames={FPS * 13}
  fps={30}
  width={1920}
  height={1080}
  schema={hybridDemoSchema}
  defaultProps={{
    skillName: "skill-name",
    hook: "Marketing hook text",
    terminalVideo: "skill-name-demo.mp4",
    ccVersion: "CC 2.1.19",
    primaryColor: "#8b5cf6",
    showHook: true,
    showCTA: true,
    hookDuration: 45,
    ctaDuration: 75,
    backgroundMusic: "audio/ambient-tech.mp3",
    musicVolume: 0.12,
    enableSoundEffects: true,
  }}
/>
```

## Vertical Composition

```tsx
<Composition
  id="SkillNameDemo-Vertical"
  component={VerticalDemo}
  durationInFrames={FPS * 15}
  fps={30}
  width={1080}
  height={1920}
  schema={verticalDemoSchema}
  defaultProps={{
    skillName: "skill-name",
    hook: "Marketing hook text",
    terminalVideo: "skill-name-demo-vertical.mp4",
    ccVersion: "CC 2.1.19",
    primaryColor: "#8b5cf6",
    backgroundMusic: "audio/ambient-tech.mp3",
    musicVolume: 0.12,
  }}
/>
```

## Duration Calculation

```typescript
// Base formula
const duration = vhsDuration + hookDuration + ctaOverlap;

// Example: 11s VHS + 1.5s hook + 2s CTA overlap = 14.5s
const durationInFrames = Math.ceil(14.5 * FPS);
```

## Schema Definition

```typescript
export const hybridDemoSchema = z.object({
  skillName: z.string(),
  hook: z.string(),
  terminalVideo: z.string(),
  ccVersion: z.string().default("CC 2.1.19"),
  primaryColor: z.string().default("#8b5cf6"),
  showHook: z.boolean().default(true),
  showCTA: z.boolean().default(true),
  hookDuration: z.number().default(45),
  ctaDuration: z.number().default(60),
  backgroundMusic: z.string().optional(),
  musicVolume: z.number().default(0.15),
  enableSoundEffects: z.boolean().default(true),
});
```

## Adding New Composition Programmatically

```typescript
function generateComposition(skill: SkillMetadata): string {
  const id = skill.name.split('-').map(capitalize).join('');
  return `
<Composition
  id="${id}Demo"
  component={HybridDemo}
  durationInFrames={FPS * ${skill.duration}}
  fps={FPS}
  width={WIDTH}
  height={HEIGHT}
  schema={hybridDemoSchema}
  defaultProps={{
    skillName: "${skill.name}",
    hook: "${skill.hook}",
    terminalVideo: "${skill.name}-demo.mp4",
    primaryColor: "${skill.color || '#8b5cf6'}",
    ...AUDIO_DEFAULTS,
  }}
/>`;
}
```
