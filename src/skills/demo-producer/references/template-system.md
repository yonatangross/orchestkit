# Template System Architecture

Comprehensive guide to the three template systems in demo-producer and how to create configurations for any skill.

## Table of Contents

- [Overview](#overview)
- [SkillDemoConfig Interface](#skilldemoconfig-interface)
- [Template: TriTerminalRace](#template-triterminalrace)
- [Template: ProgressiveZoom](#template-progressivezoom)
- [Template: SplitThenMerge](#template-splitthenmerge)
- [Creating a Configuration for Any Skill](#creating-a-configuration-for-any-skill)
- [Shared Component Library](#shared-component-library)
- [Best Practices](#best-practices)
- [Rendering](#rendering)
- [Related Skills](#related-skills)

---

## Overview

The demo-producer skill uses a modular template system that separates concerns:

1. **Template**: Defines layout and animation (TriTerminalRace, ProgressiveZoom, SplitThenMerge)
2. **Configuration**: Provides content and timing (SkillDemoConfig)
3. **Components**: Reusable UI elements (LiveFolderTree, LevelBadge, CodePreview)

This architecture allows creating demos for any skill by providing a configuration matching the SkillDemoConfig interface.

---

## SkillDemoConfig Interface

Base configuration shared across all templates:

```typescript
interface SkillDemoConfig {
  // Skill metadata
  skillName: string;           // e.g., "explore", "commit", "debug"
  skillCommand: string;        // e.g., "/ork:explore"
  hook: string;                // Attention-grabbing opening (5-7 words)
  primaryColor: string;        // Hex color for branding

  // Timeline structure
  phases: Phase[];             // Array of execution phases

  // Template-specific content
  simple: LevelConfig;         // Beginner level
  medium: LevelConfig;         // Intermediate level
  advanced: LevelConfig;       // Advanced level

  // Summary display
  summaryTitle: string;        // e.g., "📊 RESULTS"
  summaryTagline: string;      // e.g., "Explore any skill instantly"

  // Optional overrides
  duration?: number;           // Total video duration in seconds
  fps?: number;                // Frames per second
}

interface Phase {
  name: string;                // Full name: "Analyze", "Load References"
  shortName: string;           // Abbreviation: "Analyze", "Refs"
  duration?: number;           // Duration in frames for this phase
}

interface LevelConfig {
  name: string;                // "Simple", "Medium", "Advanced"
  description: string;         // Short description of complexity level
  inputCount: number;          // Number of inputs/commands required
  files: FileEntry[];          // Files created during execution
  references: ReferenceEntry[]; // Patterns loaded
  claudeResponse: string[];    // Multi-line AI response
  completionTime: string;      // Display duration: "8s", "12s"
  metrics: Record<string, string>; // Custom metrics
}

interface FileEntry {
  name: string;                // Path: "src/components/Button.tsx"
  status: "pending" | "in-progress" | "completed";
  lines: number;               // Lines of code
  language?: string;           // For syntax highlighting
}

interface ReferenceEntry {
  name: string;                // Pattern name: "cursor-pagination"
  status: "pending" | "loading" | "loaded";
  category: string;            // Category: "core", "api", "performance"
}
```

---

## Template: TriTerminalRace

**Use when**: Showcasing the same skill at different complexity levels simultaneously.

### Architecture

```
┌─────────────────────────────────────────────┐
│           HOOK (0-2s)                       │
│    "Explore any skill with one command"     │
├─────┬─────────────────┬──────────────────────┤
│ 🟢  │ 🟡              │ 🟣                   │
│ SIM │ MED             │ ADV                  │
├─────┼─────────────────┼──────────────────────┤
│ S1  │ S2              │ S3                   │
│ 50% │ 50% [progress]  │ 30% [progress]      │
├─────┴─────────────────┴──────────────────────┤
│           SUMMARY (17-20s)                  │
│    ┌─────┐  ┌─────┐  ┌─────┐                │
│    │ 8s  │  │ 12s │  │ 15s │                │
│    └─────┘  └─────┘  └─────┘                │
└─────────────────────────────────────────────┘
```

### Configuration Example

```typescript
export const exploreSkillConfig: SkillDemoConfig = {
  skillName: "explore",
  skillCommand: "/ork:explore",
  hook: "Explore any skill instantly",
  primaryColor: "#8b5cf6",

  phases: [
    { name: "Load", shortName: "Load" },
    { name: "Parse", shortName: "Parse" },
    { name: "Display", shortName: "Show" },
  ],

  simple: {
    name: "Simple",
    description: "Single skill",
    inputCount: 1,
    files: [
      { name: "skill-output.md", status: "completed", lines: 42 },
    ],
    references: [
      { name: "skill-parser", status: "loaded", category: "core" },
    ],
    claudeResponse: [
      "I've loaded the Explore skill with:",
      "• Full skill metadata",
      "• All references and dependencies",
      "• Formatted for readability",
    ],
    completionTime: "8s",
    metrics: { "Refs Loaded": "3", "Lines": "42" },
  },

  medium: {
    name: "Medium",
    description: "Multiple skills + agent context",
    inputCount: 3,
    files: [
      { name: "skill-output.md", status: "completed", lines: 85 },
      { name: "agent-context.json", status: "completed", lines: 120 },
    ],
    references: [
      { name: "skill-parser", status: "loaded", category: "core" },
      { name: "agent-resolver", status: "loaded", category: "context" },
      { name: "markdown-renderer", status: "loaded", category: "formatting" },
    ],
    claudeResponse: [
      "Exploring skills with agent context:",
      "• 5 related agents identified",
      "• Cross-referenced patterns loaded",
      "• Context-aware display",
    ],
    completionTime: "12s",
    metrics: { "Refs Loaded": "9", "Lines": "205", "Agents": "5" },
  },

  advanced: {
    name: "Advanced",
    description: "Full ecosystem with analytics",
    inputCount: 5,
    files: [
      { name: "skill-graph.json", status: "completed", lines: 340 },
      { name: "ecosystem-analysis.json", status: "completed", lines: 210 },
      { name: "recommendations.md", status: "completed", lines: 125 },
    ],
    references: [
      { name: "skill-parser", status: "loaded", category: "core" },
      { name: "graph-analyzer", status: "loaded", category: "analysis" },
      { name: "agent-resolver", status: "loaded", category: "context" },
      { name: "ecosystem-mapper", status: "loaded", category: "discovery" },
      { name: "markdown-renderer", status: "loaded", category: "formatting" },
    ],
    claudeResponse: [
      "Full ecosystem analysis complete:",
      "• 12 related skills discovered",
      "• 8 agent touchpoints mapped",
      "• Dependency graph generated",
      "• AI-powered recommendations provided",
    ],
    completionTime: "15s",
    metrics: {
      "Refs Loaded": "15",
      "Lines": "675",
      "Agents": "8",
      "Skills": "12",
    },
  },

  summaryTitle: "📊 RESULTS",
  summaryTagline: "Explore any skill instantly with context",
};
```

### Registration in Remotion

```typescript
import { TriTerminalRace, triTerminalRaceSchema } from "./components/TriTerminalRace";
import { exploreSkillConfig } from "./components/configs/explore-demo";

<Composition
  id="ExploreTriRace"
  component={TriTerminalRace}
  durationInFrames={30 * 20}  // 20 seconds at 30fps
  fps={30}
  width={1920}
  height={1080}
  schema={triTerminalRaceSchema}
  defaultProps={exploreSkillConfig}
/>
```

### Key Components Used

- **LiveFolderTree**: Animates file structure as files are "created"
- **LevelBadge**: Color-coded left sidebar (🟢/🟡/🟣)
- **SkillReferences**: Animated reference loading indicators
- **ProgressPhases**: Phase progress indicators with completion percentage
- **ClaudeResponse**: Typewriter-effect AI response text
- **CodePreview**: Syntax-highlighted code snippets

### Customization Points

```typescript
// Adjust racing speed ratios
const simpleProgress = Math.min(100, raceProgress * 1.3);  // Faster
const mediumProgress = Math.min(100, raceProgress * 1.0);  // Normal
const advancedProgress = Math.min(100, raceProgress * 0.7); // Slower

// Change color palette
const LEVEL_COLORS = {
  simple: "#22c55e",    // Green
  medium: "#f59e0b",    // Amber
  advanced: "#8b5cf6",  // Purple
};

// Adjust panel spacing
const PANEL_WIDTH = 600;
const PANEL_GAP = 30;
```

---

## Template: ProgressiveZoom

**Use when**: Stepping through code or concepts with progressive revelation.

### Architecture

```
┌──────────────────────────────────────────────┐
│        HOOK + CODE OVERVIEW (0-2s)           │
│    ┌────────────────────────────────────┐    │
│    │  src/api/auth.ts                   │    │
│    │  12 lines, 3 key sections         │    │
│    └────────────────────────────────────┘    │
├──────────────────────────────────────────────┤
│    PHASE 1: ZOOM TO SECTION (2-8s)           │
│    ┌────────────────────────────────────┐    │
│    │  function validateToken() {        │    │
│    │  ▶ jwt.verify(token)               │    │
│    │    ├─ Signature check              │    │
│    │    └─ Expiry validation            │    │
│    └────────────────────────────────────┘    │
├──────────────────────────────────────────────┤
│    PHASE 2: ZOOM TO SECTION (8-15s)          │
│    [next section with annotations]           │
├──────────────────────────────────────────────┤
│           TIMELINE + SUMMARY (15-20s)        │
│    ✓ Validation  ✓ Error Handling  ✓ Export │
└──────────────────────────────────────────────┘
```

### Configuration Example

```typescript
export const authApiProgressiveZoomConfig: SkillDemoConfig = {
  skillName: "auth-api",
  skillCommand: "/ork:code-walkthrough",
  hook: "JWT validation pattern explained",
  primaryColor: "#06b6d4",

  phases: [
    { name: "Token Extraction", shortName: "Extract" },
    { name: "Signature Validation", shortName: "Verify" },
    { name: "Expiry Check", shortName: "Expiry" },
    { name: "Error Handling", shortName: "Errors" },
  ],

  simple: {
    name: "Basic",
    description: "Core validation only",
    inputCount: 1,
    files: [
      { name: "src/auth/validate.ts", status: "completed", lines: 15, language: "typescript" },
    ],
    references: [
      { name: "jsonwebtoken", status: "loaded", category: "library" },
    ],
    claudeResponse: [
      "Basic JWT validation:",
      "• Extract token from headers",
      "• Verify with secret key",
      "• Return user data",
    ],
    completionTime: "6s",
    metrics: { "Sections": "1", "Lines": "15" },
  },

  medium: {
    name: "Production",
    description: "With error handling",
    inputCount: 3,
    files: [
      { name: "src/auth/validate.ts", status: "completed", lines: 35, language: "typescript" },
      { name: "src/auth/errors.ts", status: "completed", lines: 20, language: "typescript" },
    ],
    references: [
      { name: "jsonwebtoken", status: "loaded", category: "library" },
      { name: "error-handling-rfc9457", status: "loaded", category: "patterns" },
    ],
    claudeResponse: [
      "Production-ready validation:",
      "• Extract from Authorization header",
      "• Verify signature and expiry",
      "• Handle 5 error cases",
      "• Return structured errors",
    ],
    completionTime: "12s",
    metrics: { "Sections": "3", "Lines": "55", "Errors": "5" },
  },

  advanced: {
    name: "Enterprise",
    description: "Multi-tenant with caching",
    inputCount: 5,
    files: [
      { name: "src/auth/validate.ts", status: "completed", lines: 65, language: "typescript" },
      { name: "src/auth/cache.ts", status: "completed", lines: 40, language: "typescript" },
      { name: "src/auth/revocation.ts", status: "completed", lines: 30, language: "typescript" },
    ],
    references: [
      { name: "jsonwebtoken", status: "loaded", category: "library" },
      { name: "redis-patterns", status: "loaded", category: "caching" },
      { name: "error-handling-rfc9457", status: "loaded", category: "patterns" },
      { name: "multi-tenancy", status: "loaded", category: "architecture" },
    ],
    claudeResponse: [
      "Enterprise JWT validation:",
      "• Multi-tenant token validation",
      "• Redis-backed revocation list",
      "• Signature + expiry + revocation checks",
      "• Structured error responses",
      "• Performance metrics collection",
    ],
    completionTime: "18s",
    metrics: { "Sections": "5", "Lines": "135", "Errors": "8", "Caching": "Redis" },
  },

  summaryTitle: "🔐 JWT VALIDATION",
  summaryTagline: "From basic to enterprise-ready",
};
```

### Key Components Used

- **CodePreview**: Full code display with line highlighting
- **Highlights**: Zoom targets and annotations
- **TimelineBar**: Phase progression timeline
- **Annotations**: Contextual callouts on code sections
- **CaptionOverlay**: Phase descriptions

### Animation Timing

```typescript
// Zoom curve: ease in/out for smooth transitions
const zoom = Easing.bezier(0.25, 0.1, 0.25, 1)(zoomProgress);

// Annotation fade in/out
const annotationOpacity = interpolate(
  frame,
  [phaseStart, phaseStart + 10, phaseEnd - 10, phaseEnd],
  [0, 1, 1, 0],
  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
);
```

---

## Template: SplitThenMerge

**Use when**: Showing transformation or before/after comparison.

### Architecture

```
┌──────────────────────────────────────────────┐
│             HOOK (0-2s)                      │
│    "Stop wasting time on repetitive tasks"   │
├─────────────────┬──────────────────────────┤
│                 │                          │
│     WITHOUT     │      WITH {SKILL}        │
│  SKILL          │                          │
│                 │                          │
│  Manual steps   │  Automated execution     │
│  120s ⏱️         │  8s ⚡                   │
│  Error-prone    │  Guaranteed consistency  │
│  Context lost   │  Full context preserved │
│                 │                          │
│  ✗ Slow         │  ✓ Fast                  │
│  ✗ Error-prone  │  ✓ Reliable              │
│  ✗ Tedious      │  ✓ Delightful            │
│                 │                          │
├─────────────────┴──────────────────────────┤
│  MERGE → UNIFIED VIEW (10-15s)              │
│    ┌───────────────────────────────────┐    │
│    │  Result: Enhanced workflow       │    │
│    │  Time: 92s saved per task        │    │
│    │  Quality: 100% consistency       │    │
│    │  Impact: 15 hours/week recovered │    │
│    └───────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

### Configuration Example

```typescript
export const buildOptimizationConfig: SkillDemoConfig = {
  skillName: "build-optimizer",
  skillCommand: "/ork:build-optimizer",
  hook: "Turn 2-minute builds into 15 seconds",
  primaryColor: "#22c55e",

  phases: [
    { name: "Analyze", shortName: "Analyze" },
    { name: "Optimize", shortName: "Optimize" },
    { name: "Build", shortName: "Build" },
  ],

  simple: {
    name: "Without Optimization",
    description: "Standard build process",
    inputCount: 1,
    files: [
      { name: "dist/bundle.js", status: "completed", lines: 250000 },
    ],
    references: [],
    claudeResponse: [
      "Building with standard webpack config...",
      "Processing 1,200 modules...",
      "Waiting for optimization...",
    ],
    completionTime: "120s",
    metrics: { "Build Time": "120s", "Bundle Size": "2.5 MB", "Chunks": "8" },
  },

  medium: {
    name: "With Optimization",
    description: "Optimized build process",
    inputCount: 3,
    files: [
      { name: "dist/bundle.js", status: "completed", lines: 85000 },
      { name: "dist/vendor.js", status: "completed", lines: 120000 },
    ],
    references: [
      { name: "webpack-optimization", status: "loaded", category: "tooling" },
    ],
    claudeResponse: [
      "Analyzing dependencies...",
      "Applying code splitting...",
      "Minifying & compressing...",
      "Optimized bundle ready",
    ],
    completionTime: "45s",
    metrics: { "Build Time": "45s", "Bundle Size": "1.2 MB", "Chunks": "3" },
  },

  advanced: {
    name: "Advanced Optimization",
    description: "Production-ready optimizations",
    inputCount: 5,
    files: [
      { name: "dist/main.js", status: "completed", lines: 45000 },
      { name: "dist/vendor.js", status: "completed", lines: 95000 },
      { name: "dist/async-routes.js", status: "completed", lines: 25000 },
    ],
    references: [
      { name: "webpack-optimization", status: "loaded", category: "tooling" },
      { name: "dynamic-imports", status: "loaded", category: "patterns" },
      { name: "cache-busting", status: "loaded", category: "deployment" },
    ],
    claudeResponse: [
      "Advanced optimization pipeline:",
      "• Tree-shaking unused code",
      "• Dynamic imports for routes",
      "• Service worker caching",
      "• Image optimization",
      "• Ready for production",
    ],
    completionTime: "15s",
    metrics: {
      "Build Time": "15s",
      "Bundle Size": "650 KB",
      "Chunks": "4",
      "Gzip": "185 KB",
    },
  },

  summaryTitle: "⚡ PERFORMANCE GAINS",
  summaryTagline: "From 120s to 15s: 8x speedup",
};
```

### Key Components Used

- **SplitScreen**: Side-by-side comparison layout
- **MergeTransition**: Dramatic merge animation
- **ContrastHighlight**: Emphasize differences
- **ImpactMetrics**: Show key improvements
- **BeforeAfterSnapshots**: Visual state comparison

### Merge Animation

```typescript
// Smooth merge from split to unified
const mergeProgress = interpolate(
  frame,
  [splitEnd, mergeStart, mergeEnd],
  [0, 0, 1],
  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
);

const leftPanelX = interpolate(mergeProgress, [0, 1], [-960, 0]);
const rightPanelX = interpolate(mergeProgress, [0, 1], [960, 0]);
```

---

## Template: ScrapbookDemo

**Use when**: Creating product showcases, brand videos, or social proof compilations with a warm, editorial aesthetic.

### Architecture

```
┌──────────────────────────────────────────────┐
│        TITLE STAMP (0-3s)                    │
│    "OrchestKit"                              │
│    80 skills. 30 agents. One plugin.         │
├──────────────────────────────────────────────┤
│    SOCIAL PROOF CARDS (3-7.5s)               │
│    ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│    │ @sarah  │  │ @marcus │  │ @priya  │   │
│    │ "..."   │  │ "..."   │  │ "..."   │   │
│    └─────────┘  └─────────┘  └─────────┘   │
├──────────────────────────────────────────────┤
│    TERMINAL CAPTURE (7.5-11.5s)              │
│    ┌────────────────────────────┐            │
│    │  $ /ork:implement ...     │ ← tilted   │
│    │  ✓ Created 3 files        │   frame    │
│    └────────────────────────────┘            │
├──────────────────────────────────────────────┤
│    STATS REVEAL (11.5-13.5s)                 │
│        197        36        111              │
│       skills    agents     hooks             │
├──────────────────────────────────────────────┤
│    CTA (13.5-17s)                            │
│    Get started                               │
│    ┌─/plugin install ork─┐                   │
│    └─────────────────────┘                   │
└──────────────────────────────────────────────┘
```

### Props Interface

```typescript
interface ScrapbookDemoProps {
  title: string;           // Hero text (e.g., "OrchestKit")
  tagline: string;         // Subtitle
  socialCards: Array<{     // 2-4 social proof quotes
    author: string;
    text: string;
    handle?: string;
  }>;
  terminalContent?: string; // Terminal output as multi-line string
  stats: {
    skills: number;
    agents: number;
    hooks: number;
  };
  ctaCommand: string;      // e.g., "/plugin install ork"
  accentColor?: string;    // Override default teal accent
}
```

### Component Breakdown

| Component | Purpose |
|-----------|---------|
| `PaperTexture` | Warm cream background with canvas grain and edge shadow |
| `KineticText` | Bold serif text that "stamps" in with spring overshoot |
| `SocialCard` | Tweet-style card with avatar, author, quote text |
| `CollageFrame` | Tilted frame with drop shadow for screenshots |
| `StatsCounter` | Animated count-up numbers with accent underlines |

### Style Constants

- **Background**: `#F0F0E8` (warm paper cream), NOT dark
- **Typography**: Georgia serif for headlines, Inter sans for data
- **Animation**: 150ms transitions, 50ms stagger, spring overshoot
- **Grain**: 4% opacity warm-toned noise
- **Vignette**: 30% intensity warm edge darkening

### Variants

- `ScrapbookDemo` — 1920x1080 landscape (16:9)
- `ScrapbookDemoSquare` — 1080x1080 square (1:1), fewer social cards

---

## Creating a Configuration for Any Skill

### Step 1: Gather Skill Information

```typescript
const skillName = "my-skill";
const skillCommand = "/ork:my-skill";

// Read from SKILL.md frontmatter
const description = "What this skill does";
const tags = ["tag1", "tag2"];

// Choose a brand color
const primaryColor = "#8b5cf6"; // Or use agent color palette
```

### Step 2: Define Phases

List the main execution phases visible in the demo:

```typescript
const phases = [
  { name: "Load Context", shortName: "Load" },
  { name: "Analyze Input", shortName: "Analyze" },
  { name: "Generate Output", shortName: "Generate" },
  { name: "Format Results", shortName: "Format" },
];
```

### Step 3: Create Simple Level

Minimal use case that completes quickly:

```typescript
simple: {
  name: "Simple",
  description: "Basic use case",
  inputCount: 1,
  files: [
    { name: "output.txt", status: "completed", lines: 20 },
  ],
  references: [
    { name: "core-pattern", status: "loaded", category: "core" },
  ],
  claudeResponse: [
    "Simple execution:",
    "• Loaded core pattern",
    "• Generated basic output",
  ],
  completionTime: "5s",
  metrics: { "Items": "1", "Lines": "20" },
},
```

### Step 4: Create Medium Level

Standard production use case:

```typescript
medium: {
  name: "Medium",
  description: "Standard use case",
  inputCount: 3,
  files: [
    { name: "output.json", status: "completed", lines: 80 },
    { name: "report.md", status: "completed", lines: 45 },
  ],
  references: [
    { name: "core-pattern", status: "loaded", category: "core" },
    { name: "formatting", status: "loaded", category: "output" },
  ],
  claudeResponse: [
    "Standard workflow:",
    "• Processed 3 inputs",
    "• Applied patterns",
    "• Generated formatted output",
  ],
  completionTime: "10s",
  metrics: { "Items": "3", "Lines": "125", "Formats": "2" },
},
```

### Step 5: Create Advanced Level

Complex, full-featured execution:

```typescript
advanced: {
  name: "Advanced",
  description: "Full ecosystem with analysis",
  inputCount: 8,
  files: [
    { name: "analysis.json", status: "completed", lines: 250 },
    { name: "recommendations.md", status: "completed", lines: 120 },
    { name: "metrics.csv", status: "completed", lines: 45 },
  ],
  references: [
    { name: "core-pattern", status: "loaded", category: "core" },
    { name: "analysis-engine", status: "loaded", category: "analysis" },
    { name: "formatting", status: "loaded", category: "output" },
    { name: "visualization", status: "loaded", category: "display" },
  ],
  claudeResponse: [
    "Advanced analysis complete:",
    "• Processed 8 complex inputs",
    "• Applied deep analysis",
    "• Generated insights",
    "• Created visualizations",
  ],
  completionTime: "18s",
  metrics: {
    "Items": "8",
    "Lines": "415",
    "Formats": "3",
    "Insights": "12",
  },
},
```

### Step 6: Add Summary

Create compelling summary messaging:

```typescript
summaryTitle: "📊 ANALYSIS COMPLETE",
summaryTagline: "From simple to advanced in one command",
```

### Step 7: Register in Remotion

```typescript
import { TriTerminalRace } from "./components/TriTerminalRace";
import { mySkillConfig } from "./components/configs/my-skill";

<Composition
  id="MySkillDemo"
  component={TriTerminalRace}
  durationInFrames={30 * 20}
  fps={30}
  width={1920}
  height={1080}
  defaultProps={mySkillConfig}
/>
```

---

## Shared Component Library

All templates use these reusable components:

| Component | File | Purpose |
|-----------|------|---------|
| `LiveFolderTree` | `shared/LiveFolderTree.tsx` | Animated file tree with progress |
| `LevelBadge` | `shared/LevelBadge.tsx` | Difficulty level indicator |
| `SkillReferences` | `shared/SkillReferences.tsx` | Reference loading animation |
| `ProgressPhases` | `shared/ProgressPhases.tsx` | Phase completion tracking |
| `ClaudeResponse` | `shared/ClaudeResponse.tsx` | Typewriter effect text |
| `CodePreview` | `shared/CodePreview.tsx` | Syntax-highlighted code |
| `CompactProgressBar` | `shared/ProgressPhases.tsx` | Footer progress indicator |

### Component Props Pattern

All components follow this pattern for consistency:

```typescript
interface ComponentProps {
  frame: number;              // Current animation frame
  fps: number;                // Frames per second
  primaryColor?: string;      // Brand color
  theme?: "dark" | "light";   // Visual theme
}
```

---

## Best Practices

### Configuration Design

1. **Use realistic metrics** - Show actual numbers from real runs
2. **Progressive complexity** - Each level should be notably more complex
3. **Concise Claude responses** - 2-4 lines max, action → result
4. **Matching file counts** - Simple (1-2), Medium (2-3), Advanced (3-5)
5. **Consistent reference categories** - Use: core, patterns, analysis, tooling, output

### Timing Guidelines

| Level | Typical Duration |
|-------|------------------|
| Simple | 5-8 seconds |
| Medium | 10-14 seconds |
| Advanced | 15-20 seconds |

### Hook Formulas

```
[Verb] [noun] in [time frame]
→ "Create docs in 30 seconds"

[Number] [benefit] with [action]
→ "8x faster builds with code splitting"

Stop [pain point]
→ "Stop waiting for optimizations"

From [bad] to [good] with [tool]
→ "From manual to automated with one command"
```

---

## Rendering

### Single Template

```bash
remotion render Root MySkillDemo out/my-skill-demo.mp4
```

### All Formats

```bash
remotion render Root MySkillDemo out/horizontal.mp4 --props='{"format":"horizontal"}'
remotion render Root MySkillDemo out/vertical.mp4 --props='{"format":"vertical"}'
remotion render Root MySkillDemo out/square.mp4 --props='{"format":"square"}'
```

### With Custom Props

```bash
remotion render Root MySkillDemo out/custom.mp4 \
  --props='{"hook":"Custom hook text","primaryColor":"#ff00ff"}'
```

---

## Related Skills

- `ork:demo-producer` - Main skill for orchestrating demo creation
- `video-production` - Recording, composition, audio, and visual effects for demos
