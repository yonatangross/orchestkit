# Audio Ducking Patterns

Comprehensive guide to automatic audio ducking (sidechain compression) for video production.

## What is Ducking?

Ducking automatically lowers background audio (typically music) when foreground audio (typically voice) is present.

```
Without Ducking:
Voice:  ████████░░░░████████░░░░████████
Music:  ████████████████████████████████
Result: Voice fights with music, hard to understand

With Ducking:
Voice:  ████████░░░░████████░░░░████████
Music:  ██░░░░████████░░░░████████░░░░██
Result: Music dips when voice is present, clear audio
```

## Basic Ducking with ffmpeg

### Simple Sidechain Compression

```bash
ffmpeg -i narration.mp3 -i music.mp3 \
  -filter_complex "\
    [0:a]asplit=2[narr][sidechain];\
    [1:a][sidechain]sidechaincompress[ducked];\
    [narr][ducked]amix=inputs=2:duration=first" \
  output.m4a
```

### How It Works

1. `asplit=2` - Splits narration into two copies
2. First copy `[narr]` - Goes to final mix as-is
3. Second copy `[sidechain]` - Controls the compressor
4. `sidechaincompress` - Compresses music when sidechain has signal
5. `amix` - Combines processed tracks

## Ducking Parameters Explained

```bash
sidechaincompress=threshold=0.02:ratio=10:attack=50:release=500:knee=6:makeup=1
```

### Parameter Reference

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| threshold | 0.0-1.0 | 0.125 | Signal level that triggers compression |
| ratio | 1:1-20:1 | 2:1 | Amount of gain reduction |
| attack | 0.01-2000ms | 20ms | How fast compression engages |
| release | 0.01-9000ms | 250ms | How fast compression releases |
| knee | 0-8 dB | 2.82843 | Softness of compression curve |
| makeup | dB | 1 | Gain applied after compression |
| mix | 0.0-1.0 | 1.0 | Wet/dry mix |
| detection | peak/rms | rms | How signal is measured |
| link | average/maximum | average | Multi-channel linking |

### Parameter Effects

```
Threshold:
  Higher (0.1-0.5)  = Only loud speech triggers ducking
  Lower (0.01-0.05) = Even quiet speech triggers ducking

Ratio:
  2:1-4:1   = Gentle ducking (music slightly quieter)
  8:1-12:1  = Strong ducking (music noticeably dips)
  15:1-20:1 = Aggressive ducking (music nearly silent)

Attack:
  Fast (5-30ms)    = Immediate response, may sound abrupt
  Medium (30-100ms) = Natural response, recommended
  Slow (100-500ms) = Gradual dip, music "fades" down

Release:
  Fast (100-300ms) = Quick recovery, energetic feel
  Medium (300-800ms) = Natural recovery, recommended
  Slow (800-2000ms) = Gradual recovery, smooth feel
```

## Ducking Presets by Use Case

### Podcast/Interview

Clear voice with minimal music presence during speech.

```bash
ffmpeg -i voice.mp3 -i music.mp3 \
  -filter_complex "\
    [0:a]asplit=2[v][sc];\
    [1:a]volume=0.2[m];\
    [m][sc]sidechaincompress=threshold=0.03:ratio=12:attack=40:release=600:knee=4[ducked];\
    [v][ducked]amix=inputs=2:duration=first" \
  output.m4a
```

Settings explained:
- `threshold=0.03` - Sensitive to speech
- `ratio=12` - Strong ducking
- `attack=40` - Reasonably quick
- `release=600` - Natural recovery
- Pre-volume music at 20% for additional headroom

### Corporate/Business Video

Professional sound with supportive background music.

```bash
ffmpeg -i narration.mp3 -i corporate_music.mp3 \
  -filter_complex "\
    [0:a]asplit=2[narr][sc];\
    [1:a]volume=0.25[m];\
    [m][sc]sidechaincompress=threshold=0.02:ratio=10:attack=50:release=500:knee=6[ducked];\
    [narr][ducked]amix=inputs=2:duration=first:weights='1 0.6'" \
  output.m4a
```

### Tutorial/Educational

Maximum clarity with subtle musical support.

```bash
ffmpeg -i tutorial_voice.mp3 -i background_music.mp3 \
  -filter_complex "\
    [0:a]asplit=2[v][sc];\
    [1:a]volume=0.15[m];\
    [m][sc]sidechaincompress=threshold=0.015:ratio=15:attack=30:release=800:knee=4[ducked];\
    [v][ducked]amix=inputs=2:duration=first" \
  output.m4a
```

Settings explained:
- `threshold=0.015` - Very sensitive
- `ratio=15` - Aggressive ducking
- `attack=30` - Fast response
- `release=800` - Smooth return
- Pre-volume music at 15%

### Social Media/Promo

Energetic feel with prominent music.

```bash
ffmpeg -i voiceover.mp3 -i energetic_music.mp3 \
  -filter_complex "\
    [0:a]asplit=2[v][sc];\
    [1:a]volume=0.35[m];\
    [m][sc]sidechaincompress=threshold=0.04:ratio=6:attack=20:release=300:knee=8[ducked];\
    [v][ducked]amix=inputs=2:duration=first" \
  output.m4a
```

Settings explained:
- `threshold=0.04` - Less sensitive, more music presence
- `ratio=6` - Gentle ducking
- `attack=20` - Quick response
- `release=300` - Fast recovery, keeps energy
- Pre-volume music at 35%

### Documentary/Cinematic

Dramatic ducking with emotional impact.

```bash
ffmpeg -i narration.mp3 -i cinematic_music.mp3 \
  -filter_complex "\
    [0:a]asplit=2[narr][sc];\
    [1:a]volume=0.4[m];\
    [m][sc]sidechaincompress=threshold=0.025:ratio=8:attack=80:release=1000:knee=6[ducked];\
    [narr][ducked]amix=inputs=2:duration=first" \
  output.m4a
```

Settings explained:
- `attack=80` - Slower, more dramatic dip
- `release=1000` - Gradual swell back
- Higher music volume for cinematic feel

## Advanced Ducking Patterns

### Multi-Band Ducking

Duck only specific frequencies (preserve music bass).

```bash
ffmpeg -i voice.mp3 -i music.mp3 \
  -filter_complex "\
    [0:a]asplit=2[v][sc];\
    [1:a]asplit=2[m_full][m_low];\
    [m_low]lowpass=f=200[bass];\
    [m_full]highpass=f=200[mids_highs];\
    [mids_highs][sc]sidechaincompress=threshold=0.02:ratio=10:attack=50:release=500[ducked_mh];\
    [bass][ducked_mh]amix=inputs=2:normalize=0[music_processed];\
    [v][music_processed]amix=inputs=2:duration=first" \
  output.m4a
```

### Delayed Ducking

Start ducking slightly before voice (look-ahead).

```bash
ffmpeg -i voice.mp3 -i music.mp3 \
  -filter_complex "\
    [0:a]asplit=2[v][sc_pre];\
    [sc_pre]adelay=-100|-100[sc];\
    [1:a][sc]sidechaincompress=threshold=0.02:ratio=10:attack=50:release=500[ducked];\
    [v][ducked]amix=inputs=2:duration=first" \
  output.m4a
```

Note: Negative delay requires padding or trimming to align.

### Ducking Multiple Sources

Duck music under multiple speakers.

```bash
ffmpeg -i speaker1.mp3 -i speaker2.mp3 -i music.mp3 \
  -filter_complex "\
    [0:a][1:a]amix=inputs=2[voices];\
    [voices]asplit=2[v][sc];\
    [2:a]volume=0.25[m];\
    [m][sc]sidechaincompress=threshold=0.02:ratio=10:attack=50:release=500[ducked];\
    [v][ducked]amix=inputs=2:duration=first" \
  output.m4a
```

### Parallel Ducking (New York Style)

Blend ducked and unducked music for fuller sound.

```bash
ffmpeg -i voice.mp3 -i music.mp3 \
  -filter_complex "\
    [0:a]asplit=2[v][sc];\
    [1:a]asplit=2[m_dry][m_wet];\
    [m_dry]volume=0.1[dry];\
    [m_wet][sc]sidechaincompress=threshold=0.015:ratio=15:attack=30:release=600[ducked];\
    [ducked]volume=0.15[wet];\
    [dry][wet]amix=inputs=2:normalize=0[m_parallel];\
    [v][m_parallel]amix=inputs=2:duration=first" \
  output.m4a
```

## Timing Visualization

### Standard Ducking Behavior

```
Time:     0    1    2    3    4    5    6    7    8    9    10s
Voice:    ░░░░ ████ ████ ████ ░░░░ ░░░░ ████ ████ ░░░░ ░░░░
                │    │    │              │    │
                ▼    │    │              ▼    │
Attack:   ─────┐    │    │         ─────┐    │
               │    │    │              │    │
Music:    ████ ▼    │    │         ████ ▼    │    ████ ████
               ██   │    │              ██   │
                    │    │Release:           │
                    ▼    ▼                   ▼
               ░░   ░░   ██▄▄▄        ░░   ██▄▄▄
```

### Attack Time Comparison

```
Attack = 20ms (Fast):
Voice:    ░░░░░████████████░░░░░
Music:    ████▼░░░░░░░░░░░█████
               └── Immediate dip

Attack = 100ms (Slow):
Voice:    ░░░░░████████████░░░░░
Music:    █████▼▄▄░░░░░░░██████
                └── Gradual dip
```

### Release Time Comparison

```
Release = 200ms (Fast):
Voice:    ████████░░░░░░░░░░░░░
Music:    ░░░░░░░░█████████████
                 └── Quick return

Release = 1000ms (Slow):
Voice:    ████████░░░░░░░░░░░░░
Music:    ░░░░░░░░▄▄▄█████████
                 └── Gradual return
```

## Troubleshooting

### Problem: Pumping/Breathing Effect

Music volume changes are too obvious, creating a "pumping" sound.

```bash
# Solution 1: Increase attack and release times
sidechaincompress=threshold=0.02:ratio=8:attack=80:release=800

# Solution 2: Reduce ratio
sidechaincompress=threshold=0.02:ratio=4:attack=50:release=500

# Solution 3: Increase knee for softer transition
sidechaincompress=threshold=0.02:ratio=10:attack=50:release=500:knee=10
```

### Problem: Music Too Quiet During Speech

Ducking is too aggressive, music disappears.

```bash
# Solution 1: Reduce ratio
sidechaincompress=threshold=0.02:ratio=4  # Instead of ratio=12

# Solution 2: Use mix parameter for parallel compression
sidechaincompress=threshold=0.02:ratio=10:mix=0.7

# Solution 3: Increase base music volume
[1:a]volume=0.3[m]  # Instead of volume=0.15
```

### Problem: Voice Triggers Ducking Late

Music stays loud at beginning of speech.

```bash
# Solution 1: Faster attack
sidechaincompress=attack=10  # Instead of attack=50

# Solution 2: Lower threshold (more sensitive)
sidechaincompress=threshold=0.01  # Instead of threshold=0.02
```

### Problem: Music Stays Ducked Too Long

Music doesn't return between phrases.

```bash
# Solution 1: Faster release
sidechaincompress=release=300  # Instead of release=800

# Solution 2: Higher threshold (less sensitive)
sidechaincompress=threshold=0.04  # Won't trigger on quiet sounds
```

### Problem: Quiet Speech Doesn't Trigger Ducking

Some words get lost in the music.

```bash
# Solution 1: Lower threshold
sidechaincompress=threshold=0.01

# Solution 2: Compress voice first to even out levels
[0:a]acompressor=threshold=-20dB:ratio=3:attack=5:release=50,asplit=2[v][sc]
```

## Complete Production Example

### Video with Narration, Music, and SFX

```bash
ffmpeg -i video.mp4 -i narration.wav -i music.mp3 -i sfx.wav \
  -filter_complex "\
    [1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,\
         acompressor=threshold=-18dB:ratio=3:attack=5:release=100,\
         asplit=2[narr][sidechain];\
    [2:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,\
         volume=0.25[music_pre];\
    [music_pre][sidechain]sidechaincompress=\
         threshold=0.02:\
         ratio=10:\
         attack=50:\
         release=500:\
         knee=6[music_ducked];\
    [3:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,\
         adelay=5000|5000,\
         volume=0.7[sfx];\
    [narr][music_ducked][sfx]amix=inputs=3:duration=first:normalize=0[mix];\
    [mix]loudnorm=I=-14:TP=-1:LRA=11,\
         alimiter=level_out=0.95[final]" \
  -map 0:v -map "[final]" \
  -c:v copy -c:a aac -b:a 192k \
  output.mp4
```

## Quick Reference

```
Use Case              Threshold  Ratio  Attack  Release  Pre-Vol
------------------------------------------------------------------
Podcast               0.03       12:1   40ms    600ms    20%
Corporate             0.02       10:1   50ms    500ms    25%
Tutorial              0.015      15:1   30ms    800ms    15%
Social Media          0.04       6:1    20ms    300ms    35%
Documentary           0.025      8:1    80ms    1000ms   40%

Problem               Quick Fix
------------------------------------------------------------------
Pumping               Increase attack/release, reduce ratio
Too quiet             Reduce ratio, increase pre-volume
Late ducking          Faster attack, lower threshold
Stays ducked          Faster release, higher threshold
Inconsistent          Compress voice first
```
