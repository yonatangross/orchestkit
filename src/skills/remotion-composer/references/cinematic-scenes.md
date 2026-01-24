# Cinematic Scene Composition

## 6-Scene Timeline Structure

Cinematic demos follow a 6-scene narrative structure optimized for marketing:

```
Scene 1: Hook (2s)      → Skill name, tagline, stats badge
Scene 2: Problem (3s)   → Pain points with X icons
Scene 3: Animation (4-6s) → Manim MP4 overlay (agents/deps)
Scene 4: Terminal (10s) → VHS recording with CC 2.1.16 features
Scene 5: Results (3s)   → Before/After comparison
Scene 6: CTA (2s)       → Install button with pulse
```

## CinematicDemo Props

```tsx
<CinematicDemo
  skillName="verify"
  hook="6 parallel agents validate your feature"
  problemPoints={[
    "Manual testing misses edge cases",
    "Sequential reviews waste hours",
    "No unified verification report",
  ]}
  terminalVideo="verify-demo.mp4"
  manimVideo="verify-agents.mp4"  // Optional
  manimType="agent-spawning"      // Fallback if no video
  results={{
    before: "3 hours manual review",
    after: "2 minutes with OrchestKit",
    stats: [
      { label: "Agents", value: 6 },
      { label: "Coverage", value: "94", suffix: "%" },
    ],
  }}
  primaryColor="#22c55e"
  // Scene durations in frames (30 FPS)
  hookDuration={60}      // 2 seconds
  problemDuration={90}   // 3 seconds
  manimDuration={120}    // 4 seconds
  terminalDuration={300} // 10 seconds
  resultsDuration={90}   // 3 seconds
  ctaDuration={60}       // 2 seconds
/>
```

## Scene Components

### HookScene
- CC version badge with spring animation
- Skill name with glow effect
- Marketing hook text
- Stats badge (skills * agents)

### ProblemScene
- "Before OrchestKit" title
- 2-3 pain points with X icons
- Staggered reveal animation
- Red warning glow background

### ManimScene
- Manim MP4 video overlay (if provided)
- ManimPlaceholder fallback:
  - `agent-spawning`: Animated agent boxes
  - `task-dependency`: Task graph visualization
  - `workflow`: Phase pipeline

### TerminalScene
- VHS-generated terminal video
- Optional header badge
- Subtle zoom pulse
- Vignette overlay

### ResultsScene
- Before/After cards
- Animated arrow transition
- Stats row with counting animation
- Success glow background

### CTAScene
- Install button with pulse animation
- Stats line (skills * agents * CC version)
- Tagline text

## Vertical Variant

CinematicVerticalDemo (1080x1920) uses:
- Shorter durations (18s total vs 25s)
- Stacked layouts
- Larger text (36px vs 24px)
- 2 problem points max
- Simplified results

## Integration with Manim

Generate Manim animations:
```bash
cd skills/manim-visualizer/scripts
python generate.py agent-spawning --preset verify -o public/manim/verify-agents.mp4
python generate.py task-dependency --preset verify -o public/manim/verify-deps.mp4
```

## Audio Layer

```tsx
// Background music with fade
{backgroundMusic && (
  <Audio
    src={staticFile(backgroundMusic)}
    volume={(f) => {
      const fadeIn = Math.min(1, f / (fps * 0.5));
      const fadeOut = Math.min(1, (durationInFrames - f) / (fps * 1));
      return fadeIn * fadeOut * musicVolume;
    }}
  />
)}

// Success sound on CTA
{frame >= ctaStart && frame < ctaStart + 2 && (
  <Audio src={staticFile("audio/success.mp3")} volume={0.3} />
)}
```

## Rendering

```bash
# Preview
cd orchestkit-demos && npm run preview

# Render specific composition
npx remotion render VerifyCinematicDemo out/verify-cinematic.mp4

# Render all cinematic demos
for comp in Verify Explore ReviewPR Commit Implement; do
  npx remotion render ${comp}CinematicDemo out/${comp,,}-cinematic.mp4
done
```
