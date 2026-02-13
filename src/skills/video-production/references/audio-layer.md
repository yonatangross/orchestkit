# Audio Layer

## Audio Component Usage

```tsx
import { Audio, staticFile } from "remotion";

// Background music with fade
<Audio
  src={staticFile("audio/ambient-tech.mp3")}
  volume={(f) => {
    const fadeIn = Math.min(1, f / (fps * 0.5));
    const fadeOut = Math.min(1, (durationInFrames - f) / (fps * 1));
    return fadeIn * fadeOut * musicVolume;
  }}
/>

// Sound effect
{frame >= ctaStart && frame < ctaStart + 2 && (
  <Audio src={staticFile("audio/success.mp3")} volume={0.3} />
)}
```

## Volume Guidelines

| Audio Type | Volume | Notes |
|------------|--------|-------|
| Background music | 0.10-0.15 | Subtle, non-distracting |
| Success SFX | 0.25-0.35 | Noticeable but not jarring |
| UI sounds | 0.20-0.30 | Clicks, transitions |

## Fade Patterns

### Fade In (0.5s)
```typescript
const fadeIn = Math.min(1, frame / (fps * 0.5));
```

### Fade Out (1s)
```typescript
const fadeOut = Math.min(1, (durationInFrames - frame) / (fps * 1));
```

### Combined
```typescript
volume={(f) => fadeIn(f) * fadeOut(f) * baseVolume}
```

## Audio File Requirements

| File | Format | Duration | Size |
|------|--------|----------|------|
| ambient-tech.mp3 | MP3 128kbps | 15-30s | <500KB |
| success.mp3 | MP3 128kbps | 0.2-0.5s | <10KB |

## Generating Audio with FFmpeg

### Ambient drone
```bash
ffmpeg -f lavfi -i "sine=frequency=110:duration=20" \
  -f lavfi -i "sine=frequency=165:duration=20" \
  -f lavfi -i "sine=frequency=220:duration=20" \
  -filter_complex "[0:a]volume=0.3[a];[1:a]volume=0.2[b];[2:a]volume=0.15[c];[a][b][c]amix=inputs=3:duration=longest,lowpass=f=400,afade=t=in:st=0:d=2,afade=t=out:st=18:d=2" \
  -y audio/ambient-tech.mp3
```

### Success chime
```bash
ffmpeg -f lavfi -i "sine=frequency=523:duration=0.12" \
  -f lavfi -i "sine=frequency=659:duration=0.12" \
  -filter_complex "[0:a]adelay=0|0[a];[1:a]adelay=80|80[b];[a][b]amix=inputs=2:duration=longest,afade=t=in:st=0:d=0.02,afade=t=out:st=0.15:d=0.05" \
  -y audio/success.mp3
```

## Silence Detection

Skip audio if video has no content:
```typescript
{terminalVideoExists && backgroundMusic && (
  <Audio src={staticFile(backgroundMusic)} ... />
)}
```
