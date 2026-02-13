# Audio Mixing Guide for Remotion Videos

Complete guide for mixing music, SFX, and optional narration in Remotion-based tech demo videos.

## Audio Architecture in Remotion

### Layer Structure
```
Layer 5: Narration/Voice (highest priority)
Layer 4: Primary SFX (UI interactions, key events)
Layer 3: Secondary SFX (ambient, subtle feedback)
Layer 2: Music (background)
Layer 1: Ambient/Room tone (lowest, optional)
```

### Volume Hierarchy
```typescript
const volumeLevels = {
  narration: 1.0,      // 0dB reference
  primarySfx: 0.7,     // -3dB
  secondarySfx: 0.4,   // -8dB
  musicNormal: 0.25,   // -12dB
  musicDucked: 0.1,    // -20dB
  ambient: 0.15,       // -16dB
};
```

## Remotion Audio Components

### Basic Audio Implementation
```typescript
import { Audio, staticFile, useCurrentFrame, interpolate } from 'remotion';

export const BackgroundMusic: React.FC = () => {
  const frame = useCurrentFrame();

  const volume = interpolate(
    frame,
    [0, 30, 270, 300],
    [0, 0.25, 0.25, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <Audio
      src={staticFile('music/background.mp3')}
      volume={volume}
    />
  );
};
```

### SFX Trigger Component
```typescript
import { Audio, staticFile, Sequence } from 'remotion';

interface SfxProps {
  src: string;
  startFrame: number;
  volume?: number;
}

export const Sfx: React.FC<SfxProps> = ({
  src,
  startFrame,
  volume = 0.7
}) => {
  return (
    <Sequence from={startFrame} durationInFrames={60}>
      <Audio
        src={staticFile(`sfx/${src}`)}
        volume={volume}
      />
    </Sequence>
  );
};
```

## Volume Curves and Fades

### Fade In Implementation
```typescript
const fadeIn = (
  frame: number,
  startFrame: number,
  duration: number,
  targetVolume: number
) => {
  return interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, targetVolume],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
};
```

### Fade Out Implementation
```typescript
const fadeOut = (
  frame: number,
  endFrame: number,
  duration: number,
  startVolume: number
) => {
  return interpolate(
    frame,
    [endFrame - duration, endFrame],
    [startVolume, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
};
```

### Exponential Fade (Natural Decay)
```typescript
const exponentialFade = (
  frame: number,
  startFrame: number,
  endFrame: number,
  startVolume: number
) => {
  const progress = interpolate(
    frame,
    [startFrame, endFrame],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Exponential curve for natural-sounding fade
  return startVolume * Math.pow(1 - progress, 2);
};
```

### S-Curve Crossfade
```typescript
const sCurveFade = (
  frame: number,
  startFrame: number,
  endFrame: number
) => {
  const progress = interpolate(
    frame,
    [startFrame, endFrame],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // S-curve for smooth crossfade
  return progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
};
```

## Ducking System

### Basic Ducking
```typescript
interface DuckingConfig {
  triggerFrames: [number, number][]; // [start, end] pairs
  normalVolume: number;
  duckedVolume: number;
  attackFrames: number;
  releaseFrames: number;
}

const useDucking = (frame: number, config: DuckingConfig) => {
  const { triggerFrames, normalVolume, duckedVolume, attackFrames, releaseFrames } = config;

  let volume = normalVolume;

  for (const [start, end] of triggerFrames) {
    if (frame >= start - attackFrames && frame <= end + releaseFrames) {
      if (frame < start) {
        // Attack phase
        volume = interpolate(
          frame,
          [start - attackFrames, start],
          [normalVolume, duckedVolume]
        );
      } else if (frame > end) {
        // Release phase
        volume = interpolate(
          frame,
          [end, end + releaseFrames],
          [duckedVolume, normalVolume]
        );
      } else {
        // Ducked
        volume = duckedVolume;
      }
      break;
    }
  }

  return volume;
};
```

### Advanced Ducking with Voice Detection
```typescript
interface VoiceSegment {
  startFrame: number;
  endFrame: number;
}

const MusicWithDucking: React.FC<{ voiceSegments: VoiceSegment[] }> = ({
  voiceSegments
}) => {
  const frame = useCurrentFrame();

  const duckingConfig: DuckingConfig = {
    triggerFrames: voiceSegments.map(s => [s.startFrame, s.endFrame]),
    normalVolume: 0.25,
    duckedVolume: 0.08,
    attackFrames: 6,  // 200ms at 30fps
    releaseFrames: 12, // 400ms at 30fps
  };

  const volume = useDucking(frame, duckingConfig);

  return (
    <Audio
      src={staticFile('music/background.mp3')}
      volume={volume}
    />
  );
};
```

## Mixing Presets

### Tech Demo Standard Mix
```typescript
const techDemoMix = {
  music: {
    normalVolume: 0.2,
    duckedVolume: 0.06,
    fadeInDuration: 45, // 1.5s at 30fps
    fadeOutDuration: 60, // 2s at 30fps
  },
  sfx: {
    typing: 0.5,
    click: 0.6,
    success: 0.7,
    error: 0.65,
    transition: 0.55,
    notification: 0.75,
  },
  ambient: {
    dataFlow: 0.1,
    roomTone: 0.05,
  },
};
```

### Energetic Demo Mix
```typescript
const energeticMix = {
  music: {
    normalVolume: 0.3,
    duckedVolume: 0.1,
    fadeInDuration: 30,
    fadeOutDuration: 45,
  },
  sfx: {
    typing: 0.55,
    click: 0.65,
    success: 0.8,
    error: 0.7,
    transition: 0.65,
    notification: 0.8,
  },
  ambient: {
    dataFlow: 0.15,
    roomTone: 0.08,
  },
};
```

### Calm Tutorial Mix
```typescript
const calmTutorialMix = {
  music: {
    normalVolume: 0.15,
    duckedVolume: 0.04,
    fadeInDuration: 60,
    fadeOutDuration: 90,
  },
  sfx: {
    typing: 0.4,
    click: 0.5,
    success: 0.55,
    error: 0.5,
    transition: 0.45,
    notification: 0.6,
  },
  ambient: {
    dataFlow: 0.08,
    roomTone: 0.03,
  },
};
```

## Audio Manager Component

### Centralized Audio Control
```typescript
import React, { createContext, useContext } from 'react';
import { Audio, Sequence, staticFile, useCurrentFrame, interpolate } from 'remotion';

interface AudioEvent {
  type: 'sfx' | 'music';
  src: string;
  startFrame: number;
  duration?: number;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
}

interface AudioManagerProps {
  events: AudioEvent[];
  musicTrack?: string;
  voiceSegments?: [number, number][];
}

export const AudioManager: React.FC<AudioManagerProps> = ({
  events,
  musicTrack,
  voiceSegments = [],
}) => {
  const frame = useCurrentFrame();

  // Calculate ducked music volume
  const getMusicVolume = () => {
    let baseVolume = 0.2;

    // Fade in first 45 frames
    if (frame < 45) {
      baseVolume = interpolate(frame, [0, 45], [0, 0.2]);
    }

    // Check for voice ducking
    for (const [start, end] of voiceSegments) {
      if (frame >= start - 6 && frame <= end + 12) {
        if (frame < start) {
          return interpolate(frame, [start - 6, start], [baseVolume, 0.06]);
        } else if (frame > end) {
          return interpolate(frame, [end, end + 12], [0.06, baseVolume]);
        }
        return 0.06;
      }
    }

    return baseVolume;
  };

  return (
    <>
      {/* Background Music */}
      {musicTrack && (
        <Audio
          src={staticFile(`music/${musicTrack}`)}
          volume={getMusicVolume()}
        />
      )}

      {/* SFX Events */}
      {events.filter(e => e.type === 'sfx').map((event, i) => (
        <Sequence
          key={`sfx-${i}`}
          from={event.startFrame}
          durationInFrames={event.duration || 60}
        >
          <Audio
            src={staticFile(`sfx/${event.src}`)}
            volume={event.volume || 0.6}
          />
        </Sequence>
      ))}
    </>
  );
};
```

## Mixing Best Practices

### Level Matching
1. **Reference track**: Compare against professional content
2. **Loudness metering**: Target -14 LUFS for YouTube
3. **Peak limiting**: Never exceed -1dB true peak
4. **Dynamic range**: Maintain 6-10 dB for clarity

### Frequency Balance
```
Low (20-200Hz):     Music bass, deep SFX
Low-mid (200-500Hz): Music body, weight
Mid (500-2kHz):     Voice clarity zone (duck music here)
High-mid (2-6kHz):  Presence, SFX clarity
High (6-20kHz):     Air, sparkle, crispness
```

### Spatial Positioning
```typescript
// Remotion doesn't have native panning, but for stereo sources:
// - Center: UI clicks, notifications, voice
// - Slight left/right: Ambient, transitions
// - Avoid hard panning for accessibility
```

## Common Mixing Issues and Solutions

### Issue: SFX Too Quiet
```typescript
// Solution: Increase relative to music
const sfxVolume = musicVolume * 3; // 3x music level
```

### Issue: Music Overpowers
```typescript
// Solution: Lower base level, increase ducking
const musicConfig = {
  normalVolume: 0.15,  // Lower baseline
  duckedVolume: 0.04,  // More aggressive duck
};
```

### Issue: Harsh Transitions
```typescript
// Solution: Longer fades, S-curve
const fadeConfig = {
  duration: 45,  // 1.5s instead of 0.5s
  curve: 'sCurve',  // Instead of linear
};
```

### Issue: Clicks/Pops
```typescript
// Solution: Add micro-fades to SFX
const sfxWithFade = (frame: number, startFrame: number, volume: number) => {
  // 2-frame fade in/out prevents clicks
  const fadeFrames = 2;
  return interpolate(
    frame,
    [startFrame, startFrame + fadeFrames],
    [0, volume],
    { extrapolateRight: 'clamp' }
  );
};
```

## Export Settings

### YouTube/General Web
```
Format: AAC
Bitrate: 256kbps
Sample rate: 48kHz
Channels: Stereo
Loudness: -14 LUFS
True peak: -1dB
```

### High Quality
```
Format: PCM (WAV) or FLAC
Bit depth: 24-bit
Sample rate: 48kHz
Channels: Stereo
Loudness: -14 LUFS
True peak: -1dB
```

## Audio QA Checklist

Before final render:
- [ ] All SFX trigger at correct frames
- [ ] Music fades in smoothly
- [ ] Music fades out at end
- [ ] Ducking activates for voice segments
- [ ] No audio clipping (peaks under -1dB)
- [ ] SFX audible over music
- [ ] No unintended silence gaps
- [ ] Transitions sound smooth
- [ ] Overall loudness is consistent
- [ ] Tested on speakers and headphones
