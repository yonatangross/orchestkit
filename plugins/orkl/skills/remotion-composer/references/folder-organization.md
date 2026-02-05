# Remotion Folder Organization

Guide to organizing compositions in `orchestkit-demos/src/Root.tsx`.

## Folder Hierarchy

```
Root.tsx
├── Production/                    # Ready-to-render videos
│   ├── Landscape-16x9/           # 1920x1080 (YouTube, Website)
│   │   ├── Core-Skills/          # Foundation skills
│   │   ├── Memory-Skills/        # Knowledge graph skills
│   │   ├── Review-Skills/        # Code review skills
│   │   ├── DevOps-Skills/        # Infrastructure skills
│   │   ├── AI-Skills/            # AI-powered skills
│   │   ├── Advanced-Skills/      # Power user skills
│   │   └── Styles/               # Alternative visualizations
│   │       ├── ProgressiveZoom/
│   │       ├── SplitMerge/
│   │       ├── Cinematic/
│   │       ├── Hybrid-VHS/
│   │       └── SkillPhase/
│   ├── Vertical-9x16/            # 1080x1920 (TikTok, Reels)
│   │   ├── TriTerminalRace/
│   │   ├── ProgressiveZoom/
│   │   ├── SplitMerge/
│   │   ├── VHS/
│   │   └── Cinematic/
│   ├── Square-1x1/               # 1080x1080 (Instagram, LinkedIn)
│   │   ├── TriTerminalRace/
│   │   ├── ProgressiveZoom/
│   │   ├── SplitMerge/
│   │   └── Social/
│   └── Marketing/                # Brand & intro videos
├── Templates/                    # Reference examples (one per style)
└── Experiments/                  # WIP and testing
```

## Skill Category Mapping

| Category | Skills | Primary Color |
|----------|--------|---------------|
| Core-Skills | implement, verify, commit, explore | #8b5cf6 (purple), #22c55e (green), #06b6d4 (cyan) |
| Memory-Skills | remember, memory | #ec4899 (pink) |
| Review-Skills | review-pr, create-pr, fix-issue | #f97316 (orange) |
| DevOps-Skills | doctor, configure, run-tests, feedback | #14b8a6 (teal) |
| AI-Skills | brainstorming, assess, assess-complexity | #f59e0b (amber) |
| Advanced-Skills | worktree-coordination, skill-evolution, demo-producer, add-golden | #6366f1 (indigo) |

## Composition ID Conventions

IDs must be **globally unique** across all folders.

### Landscape (No Prefix)
```tsx
<Composition id="Implement" ... />
<Composition id="Verify" ... />
```

### Vertical (V- Prefix + Style Code)
| Style | Prefix | Example |
|-------|--------|---------|
| TriTerminalRace | V-TTR- | `V-TTR-Implement` |
| ProgressiveZoom | V-PZ- | `V-PZ-Implement` |
| SplitMerge | V-SM- | `V-SM-Implement` |
| VHS | VVHS- | `VVHS-Explore` |
| Cinematic | CINV- | `CINV-Verify` |

### Square (SQ- Prefix + Style Code)
| Style | Prefix | Example |
|-------|--------|---------|
| TriTerminalRace | SQ-TTR- | `SQ-TTR-Implement` |
| ProgressiveZoom | SQ-PZ- | `SQ-PZ-Implement` |
| SplitMerge | SQ-SM- | `SQ-SM-Implement` |

### Styles in Landscape (Style Prefix)
| Style | Prefix | Example |
|-------|--------|---------|
| ProgressiveZoom | PZ- | `PZ-Implement` |
| SplitMerge | SM- | `SM-Implement` |
| Cinematic | CIN- | `CIN-Verify` |
| Hybrid-VHS | HYB- | `HYB-Explore` |

### Special Folders
| Folder | Prefix | Example |
|--------|--------|---------|
| Templates | TPL- | `TPL-TriTerminalRace` |
| Experiments | EXP- | `EXP-Placeholder` |

## Adding a New Skill Demo

### Step 1: Create Config File
```bash
# Create config in orchestkit-demos/src/components/configs/
touch orchestkit-demos/src/components/configs/{skill-name}-demo.ts
```

```typescript
// {skill-name}-demo.ts
import { SkillDemoConfig } from "../TriTerminalRace";

export const {skillName}DemoConfig: SkillDemoConfig = {
  skillName: "{skill-name}",
  skillCommand: "/ork:{skill-name}",
  skillDescription: "Brief description",
  scenarios: {
    simple: { /* ... */ },
    medium: { /* ... */ },
    advanced: { /* ... */ },
  },
};
```

### Step 2: Add Import to Root.tsx
```typescript
import { {skillName}DemoConfig } from "./components/configs/{skill-name}-demo";
```

### Step 3: Add Compositions

1. **Landscape version** (in correct category folder):
```tsx
<Folder name="{Category}-Skills">
  <Composition
    id="{SkillName}"
    component={TriTerminalRace}
    durationInFrames={FPS * 20}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
    schema={triTerminalRaceSchema}
    defaultProps={{skillName}DemoConfig}
  />
</Folder>
```

2. **Vertical version** (in Vertical-9x16):
```tsx
<Folder name="TriTerminalRace">
  <Composition
    id="V-TTR-{SkillName}"
    component={TriTerminalRaceVertical}
    durationInFrames={FPS * 18}
    fps={FPS}
    width={VERTICAL_WIDTH}
    height={VERTICAL_HEIGHT}
    schema={triTerminalRaceVerticalSchema}
    defaultProps={{skillName}DemoConfig}
  />
</Folder>
```

3. **Square version** (optional, in Square-1x1):
```tsx
<Folder name="TriTerminalRace">
  <Composition
    id="SQ-TTR-{SkillName}"
    component={TriTerminalRaceSquare}
    durationInFrames={FPS * 20}
    fps={FPS}
    width={1080}
    height={1080}
    schema={triTerminalRaceSquareSchema}
    defaultProps={{skillName}DemoConfig}
  />
</Folder>
```

## Folder Naming Rules

Remotion folder names can only contain:
- Letters: a-z, A-Z
- Numbers: 0-9
- Hyphens: -

**Invalid:** `1. Marketing`, `Core Skills`, `Skills.Core`
**Valid:** `Marketing`, `Core-Skills`, `Skills-Core`

## When to Use Each Folder

| Folder | Use When |
|--------|----------|
| Production | Ready for rendering and distribution |
| Templates | Reference example showing component capabilities |
| Experiments | Testing new ideas, WIP, may be broken |

## Verification

After adding compositions, verify in Remotion Studio:

```bash
cd orchestkit-demos
npm run dev
# Open http://localhost:3001
# Check sidebar for new composition in correct folder
```
