---
title: Sound Effect Timing
impact: MEDIUM
impactDescription: "Well-timed sound effects reinforce visual cues and create satisfying feedback loops — mistimed or missing SFX make interactions feel hollow"
tags: sfx, sound-effects, timing, audio, transition, UI-sounds
---

## Sound Effect Timing

Sound effect selection and timing for UI interactions, transitions, and milestone moments in tech demo videos.

### SFX Timing Reference

| Event | SFX Type | Duration | Offset | Volume |
|-------|----------|----------|--------|--------|
| Task completion | Success chime | 0.3s | At checkmark | -8 dB |
| Error/failure | Low thud | 0.25s | At error display | -10 dB |
| Scene transition | Whoosh | 0.15s | At wipe start | -6 dB |
| Code typing | Key clicks | 50ms each | Per character | -18 dB |
| Agent spawn | Spawn pop | 0.2s | At icon appear | -10 dB |
| File save | Click/snap | 0.1s | At save confirm | -12 dB |
| Build success | Ascending tone | 0.5s | At green status | -8 dB |
| Notification | Soft ding | 0.15s | At badge appear | -12 dB |
| Progress milestone | Level-up tone | 0.4s | At 100% | -8 dB |
| Menu open | Slide/swish | 0.1s | At menu expand | -14 dB |

### Timing Precision Rules

```
Visual event at frame N:
  - SFX start: frame N - 1  (1 frame early feels snappier)
  - SFX peak: frame N       (peak aligns with visual peak)
  - Never more than 2 frames late (feels laggy at 30fps)
```

### ffmpeg SFX Overlay

```bash
# Add single SFX at specific timestamp
ffmpeg -i video.mp4 -i success-chime.wav \
  -filter_complex "[1:a]adelay=3200|3200,volume=0.4[sfx];\
    [0:a][sfx]amix=inputs=2:duration=first[out]" \
  -map 0:v -map "[out]" output.mp4

# Multiple SFX at different timestamps
ffmpeg -i video.mp4 -i chime.wav -i whoosh.wav -i click.wav \
  -filter_complex "\
    [1:a]adelay=3200|3200,volume=0.4[s1];\
    [2:a]adelay=8500|8500,volume=0.6[s2];\
    [3:a]adelay=15000|15000,volume=0.3[s3];\
    [0:a][s1][s2][s3]amix=inputs=4:duration=first[out]" \
  -map 0:v -map "[out]" output.mp4
```

### Remotion Audio Sequencing

```tsx
import { Audio, Sequence, staticFile } from "remotion";

// SFX aligned to visual events
<Sequence from={taskCompleteFrame - 1} durationInFrames={15}>
  <Audio src={staticFile("sfx/success-chime.wav")} volume={0.4} />
</Sequence>

<Sequence from={transitionFrame} durationInFrames={8}>
  <Audio src={staticFile("sfx/whoosh.wav")} volume={0.6} />
</Sequence>
```

### SFX Stacking Rules

- Never overlap more than 2 SFX simultaneously
- Minimum 200ms gap between consecutive SFX
- Lower-priority SFX yield to higher-priority (voice > transition > UI)
- Disable key clicks during narration segments

### Free SFX Sources

| Source | License | Best For |
|--------|---------|----------|
| Freesound.org | CC0/CC-BY | Everything |
| Mixkit | Free | Transitions, UI |
| Zapsplat | Free (attribution) | Notifications |
| Pixabay Audio | Free | Ambient, chimes |

**Key rules:** SFX peak must align with visual peak. Never exceed 2 simultaneous SFX. Key clicks at -18 dB to stay subtle.

**References:** `references/sfx-library.md`, `references/audio-timing-guide.md`
