---
title: Lottie & Rive Animations
impact: MEDIUM
impactDescription: "Pre-built Lottie animations add polish and personality that would take hours to hand-code — incorrect integration causes rendering failures and oversized bundles"
tags: lottie, rive, after-effects, animation, remotion, vector
---

## Lottie & Rive Animations

Integrate After Effects Lottie animations and Rive runtime assets into Remotion compositions for animated icons, emojis, and decorative elements.

### Setup

```bash
npm install @remotion/lottie lottie-web
# Optional: Rive runtime
npm install @rive-app/react-canvas
```

### Basic Lottie Usage

```tsx
import { Lottie, LottieAnimationData } from "@remotion/lottie";
import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

const AnimatedIcon: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading Lottie"));
  const [animationData, setAnimationData] = useState<LottieAnimationData | null>(null);

  useEffect(() => {
    fetch(staticFile("lottie/checkmark.json"))
      .then((res) => res.json())
      .then((data) => {
        setAnimationData(data);
        continueRender(handle);
      });
  }, [handle]);

  if (!animationData) return null;

  return (
    <Lottie
      animationData={animationData}
      style={{ width: 200, height: 200 }}
    />
  );
};
```

### Playback Control

```tsx
// Play specific segment (frames 0-60 of the Lottie)
<Lottie
  animationData={data}
  playbackRate={1}
  direction="forward"
  loop
  segmentStart={0}
  segmentEnd={60}
/>

// Sync to Remotion frame
import { useCurrentFrame } from "remotion";
const frame = useCurrentFrame();
<Lottie
  animationData={data}
  goTo={frame}            // Direct frame mapping
  playbackRate={0}         // Pause auto-play, use goTo
/>
```

### Common Lottie Use Cases

| Asset | Source | Duration | Size (JSON) |
|-------|--------|----------|-------------|
| Checkmark | LottieFiles | 30 frames | ~5 KB |
| Loading spinner | LottieFiles | 60 frames | ~8 KB |
| Confetti burst | LottieFiles | 90 frames | ~15 KB |
| Animated emoji | LottieFiles | 60 frames | ~10 KB |
| Arrow pointer | Custom AE | 45 frames | ~3 KB |
| Sparkle/star | LottieFiles | 30 frames | ~4 KB |

### Rive Runtime Alternative

```tsx
import { useRive, useStateMachineInput } from "@rive-app/react-canvas";

const RiveAnimation: React.FC = () => {
  const { rive, RiveComponent } = useRive({
    src: "/animations/button-states.riv",
    stateMachines: "ButtonState",
    autoplay: true,
  });

  return <RiveComponent style={{ width: 300, height: 100 }} />;
};
```

### Lottie vs Rive

| Feature | Lottie | Rive |
|---------|--------|------|
| Source tool | After Effects + Bodymovin | Rive Editor |
| File format | JSON | .riv (binary) |
| File size | Larger | 5-10x smaller |
| State machines | No | Yes |
| Interactivity | Limited | Full |
| Remotion support | `@remotion/lottie` | Manual integration |
| Free assets | LottieFiles (huge library) | Rive Community |

### Performance Tips

- Keep Lottie JSON under 50 KB per animation
- Avoid image assets inside Lottie (use vector only)
- Preload animations with `delayRender` / `continueRender`
- Use `playbackRate={0}` + `goTo` for deterministic frame sync
- Prefer `svg` renderer over `canvas` for crisp scaling

### Asset Sources

| Source | License | Format |
|--------|---------|--------|
| LottieFiles.com | Free / Premium | JSON |
| IconScout | Free / Premium | JSON |
| Lordicon | Free (attribution) | JSON |
| Rive Community | Free / Premium | .riv |

**Key rules:** Always use `delayRender`/`continueRender` for async loading. Sync to Remotion frame with `goTo` + `playbackRate={0}`. Keep JSON under 50 KB.

**References:** `references/lottie-integration.md`, `references/rive-runtime.md`
