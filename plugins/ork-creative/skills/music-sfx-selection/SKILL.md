---
name: music-sfx-selection
description: Audio selection for tech demo videos. Use when choosing background music, timing SFX, setting volume levels, or matching mood to content
tags: [video, audio, music, sfx, sound-design, mixing]
context: fork
agent: demo-producer
user-invocable: false
version: 1.0.0
complexity: low
---

# Music and SFX Selection for Tech Demo Videos

Comprehensive guide for selecting, timing, and mixing audio elements in technology demonstration videos.

## Music Matching Matrix

Match your content type to the appropriate audio style:

| Content Type | Audio Style | BPM Range | Key Characteristics |
|--------------|-------------|-----------|---------------------|
| AI/ML Demo | Electronic Ambient | 80-100 | Subtle synths, minimal percussion, futuristic pads |
| Code Tutorial | Lo-fi/Chill | 70-90 | Relaxed beats, non-intrusive, study-music feel |
| Product Launch | Uplifting Corporate | 100-120 | Building energy, positive resolution |
| Bug Fix/Debug | Tense to Resolution | 90-110 | Minor key start, major key resolution |
| Performance Demo | High Energy Electronic | 120-140 | Driving beats, impressive feel |
| API Integration | Tech Corporate | 95-115 | Professional, modern, clean |
| Security Feature | Dark Electronic | 85-105 | Suspenseful undertones, protective feel |
| Success Story | Inspirational | 100-120 | Emotional build, triumphant finish |

## BPM Guidelines by Mood

### Calm/Professional (70-90 BPM)
- Documentation walkthroughs
- Slow-paced tutorials
- Thoughtful explanations

### Moderate/Engaging (90-110 BPM)
- Standard demos
- Feature overviews
- Most tech content

### Energetic/Exciting (110-130 BPM)
- Product launches
- Performance comparisons
- Call-to-action sections

### High Energy (130-150 BPM)
- Speed demonstrations
- Competitive comparisons
- Hype moments (use sparingly)

## SFX Categories for Tech Videos

### Typing/Keyboard SFX
- **Mechanical keyboard**: Satisfying tactile sound for code input
- **Soft membrane**: Subtle for background typing
- **Terminal beep**: Old-school computer feel
- **Recommended**: Layer 2-3 variations to avoid repetition

### UI Interaction SFX
- **Click/Tap**: Button interactions, menu selections
- **Hover**: Subtle whoosh for cursor movement
- **Toggle**: Switch on/off sounds
- **Scroll**: Gentle movement indicator

### Transition SFX
- **Whoosh**: Scene changes, fast movements
- **Sweep**: Gradual transitions
- **Glitch**: Error states, interruptions
- **Portal/Warp**: Teleportation between views

### Feedback SFX
- **Success chime**: Task completion, green checkmarks
- **Error buzz**: Failed operations, red indicators
- **Warning tone**: Caution states, yellow alerts
- **Notification ping**: New messages, updates

### Ambient SFX
- **Data flow**: Background processing sound
- **Server hum**: Infrastructure ambiance
- **Digital rain**: Matrix-style atmosphere
- **Circuit pulse**: Electronic heartbeat

## SFX Timing Patterns

### Typing Sequence
```
Frame 0: First keystroke SFX
Frame 3-5: Subsequent keystrokes (randomize timing)
Every 15-20 frames: Brief pause
Final frame: Enter key or completion sound
```

### Success Animation
```
Frame 0: Action initiated (subtle click)
Frame 15-30: Processing indicator (soft loop)
Frame X: Completion (rising chime, 200-400ms)
Frame X+10: Visual confirmation lands
```

### Error Sequence
```
Frame 0: Attempt sound
Frame X: Error occurs (descending tone, 150-300ms)
Frame X+5: Visual shake/flash
Frame X+30: Recovery option appears (subtle notification)
```

### Spawn/Appear Animation
```
Frame -5: Anticipation sound (optional subtle buildup)
Frame 0: Main spawn SFX (whoosh/pop/materialize)
Frame 5-10: Settle sound (landing/placement)
```

## Volume Levels and Mixing

### Standard Mix Levels (dB)
| Element | Level | Notes |
|---------|-------|-------|
| Background Music | -18 to -15 dB | Baseline, always present |
| Music During Narration | -24 to -20 dB | Duck when speaking |
| Primary SFX | -12 to -8 dB | Important interactions |
| Secondary SFX | -18 to -14 dB | Ambient, supporting |
| Notification SFX | -10 to -6 dB | Attention-grabbing |
| Voice/Narration | -6 to -3 dB | Always prominent |

### Ducking Guidelines
- **Trigger**: Voice/narration starts
- **Attack**: 100-200ms fade down
- **Hold**: Duration of speech + 200ms
- **Release**: 300-500ms fade up
- **Reduction**: -6 to -8 dB from normal level

### Dynamic Range
- Keep music dynamic range to 6-8 dB for consistency
- Compress SFX to -3 dB peaks maximum
- Leave 3 dB headroom on master

## Audio Fade Curves

### Linear Fade
```typescript
const linearFade = (progress: number) => progress;
// Use for: Simple transitions, short fades
```

### Exponential Fade (Natural)
```typescript
const exponentialFade = (progress: number) => progress * progress;
// Use for: Fade outs, natural feeling
```

### Logarithmic Fade (Perceived Linear)
```typescript
const logarithmicFade = (progress: number) => Math.sqrt(progress);
// Use for: Fade ins, volume changes
```

### S-Curve (Smooth)
```typescript
const sCurve = (progress: number) => {
  return progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
};
// Use for: Crossfades, smooth transitions
```

### Recommended Fade Durations
| Transition Type | Duration | Curve |
|-----------------|----------|-------|
| Scene change | 500-800ms | S-Curve |
| Music intro | 1-2s | Logarithmic |
| Music outro | 2-3s | Exponential |
| SFX tail | 100-300ms | Exponential |
| Ducking | 150-250ms | S-Curve |

## Royalty-Free Audio Sources

### Premium Services
| Service | Best For | Price Range |
|---------|----------|-------------|
| Epidemic Sound | High-quality tracks, large library | $15-49/month |
| Artlist | Cinematic, modern tracks | $16-25/month |
| Musicbed | Premium, unique compositions | $9-49/month |
| Soundstripe | Good variety, unlimited downloads | $15-35/month |

### Free Resources
| Service | License | Notes |
|---------|---------|-------|
| YouTube Audio Library | Free for YouTube | Must use on YouTube |
| Pixabay | Pixabay License | Free, attribution optional |
| Free Music Archive | CC licenses | Check individual tracks |
| Incompetech | CC BY | Kevin MacLeod library |
| Mixkit | Free | Commercial use allowed |

### SFX Libraries
| Service | Type | Notes |
|---------|------|-------|
| Freesound | Community | CC licenses, huge variety |
| Zapsplat | Freemium | Good UI/UX sounds |
| Soundsnap | Premium | Professional quality |
| Epidemic Sound | Premium | Included with music sub |

## Tech/AI Demo Specific Recommendations

### AI Assistant Demos
- **Music**: Ambient electronic, subtle pulse
- **SFX**: Soft typing, thinking indicator, friendly chimes
- **Mood**: Helpful, intelligent, approachable

### Code Generation
- **Music**: Lo-fi beats, minimal electronic
- **SFX**: Fast typing, code completion pops, success tones
- **Mood**: Productive, focused, satisfying

### Performance/Speed Demos
- **Music**: Driving electronic, building intensity
- **SFX**: Whooshes, rapid transitions, impact sounds
- **Mood**: Impressive, fast, powerful

### Error Handling/Recovery
- **Music**: Tense to resolved, minor to major
- **SFX**: Warning tones, recovery sounds, success chimes
- **Mood**: Problem to solution narrative

### Integration/API Demos
- **Music**: Corporate tech, clean electronic
- **SFX**: Connection sounds, data flow, completion
- **Mood**: Professional, reliable, seamless

## Quick Reference

### Essential SFX Kit for Tech Demos
1. Keyboard clicks (3-4 variations)
2. Mouse click
3. Success chime
4. Error tone
5. Notification ping
6. Whoosh (fast/slow)
7. Pop/spawn
8. Ambient data flow

### Audio Checklist
- [ ] Music matches content mood
- [ ] BPM appropriate for pacing
- [ ] SFX synced to visual events
- [ ] Volume levels balanced
- [ ] Ducking configured for speech
- [ ] Fade curves applied
- [ ] License verified for usage
- [ ] No clipping (peaks under -3dB)

See `references/` for detailed guides on music matching, SFX libraries, and audio mixing techniques.

## Related Skills

- `audio-mixing-patterns`: ffmpeg commands for mixing narration with music
- `remotion-composer`: Audio layer integration in Remotion compositions
- `video-pacing`: Timing patterns that audio must sync with
- `demo-producer`: Full pipeline that uses these audio patterns
