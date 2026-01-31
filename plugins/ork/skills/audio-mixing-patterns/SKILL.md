---
name: audio-mixing-patterns
description: ffmpeg audio mixing patterns for video production. Use when mixing narration with music, implementing ducking, or balancing volume levels for demos
tags: [video, audio, ffmpeg, mixing, ducking, narration, music]
context: fork
agent: demo-producer
user-invocable: false
version: 1.0.0
---

# Audio Mixing Patterns

Comprehensive guide to audio mixing for video production using ffmpeg. Covers narration/music balancing, automatic ducking, timing control, and loudness normalization.

## Core Principle

**Quality Audio = Clear Narration + Supportive Music + Appropriate Levels**

The human voice occupies 85-255 Hz (fundamental) with harmonics up to 8kHz. Music must support, not compete.

## Volume Balancing Formula

```
Standard Video Mix Ratios:
--------------------------
Narration:  100% (reference level)
Music:      15-20% of narration level
SFX:        70-100% of narration level (contextual)

dB Relationships:
-----------------
Narration:  -14 dB LUFS (dialogue standard)
Music bed:  -30 to -35 dB LUFS (under narration)
Music only: -16 dB LUFS (no narration sections)
SFX:        -18 to -20 dB LUFS
```

### Volume Multiplier Quick Reference

| Ratio | Multiplier | Use Case |
|-------|------------|----------|
| 100% | 1.0 | Full volume (narration) |
| 70% | 0.7 | Prominent SFX |
| 50% | 0.5 | Equal blend |
| 30% | 0.3 | Noticeable background |
| 20% | 0.2 | Subtle bed (recommended music) |
| 15% | 0.15 | Minimal presence |
| 10% | 0.1 | Barely audible |

## Basic ffmpeg Mixing Commands

### Two-Track Mix (Narration + Music)

```bash
# Basic mix: narration at full, music at 15%
ffmpeg -i narration.mp3 -i music.mp3 \
  -filter_complex "[0:a]volume=1.0[narr];[1:a]volume=0.15[music];[narr][music]amix=inputs=2:duration=first" \
  -c:a aac -b:a 192k output.m4a
```

### Three-Track Mix (Narration + Music + SFX)

```bash
ffmpeg -i narration.mp3 -i music.mp3 -i sfx.mp3 \
  -filter_complex "\
    [0:a]volume=1.0[narr];\
    [1:a]volume=0.15[music];\
    [2:a]volume=0.7[sfx];\
    [narr][music][sfx]amix=inputs=3:duration=first:weights='3 1 2'" \
  -c:a aac -b:a 192k output.m4a
```

## Timing with adelay Filter

The `adelay` filter positions audio at precise timestamps.

### Syntax

```bash
adelay=delays[|delays...][,all=1]
# delays: milliseconds or samples (with 'S' suffix)
# all=1: apply same delay to all channels
```

### Position Music at Specific Time

```bash
# Start music at 5 seconds
ffmpeg -i narration.mp3 -i music.mp3 \
  -filter_complex "\
    [0:a]volume=1.0[narr];\
    [1:a]adelay=5000|5000,volume=0.15[music];\
    [narr][music]amix=inputs=2:duration=first" \
  output.m4a
```

### Multiple Timed Audio Cues

```bash
# Narration starts at 0, music at 2s, SFX at 5.5s
ffmpeg -i narration.mp3 -i music.mp3 -i sfx.wav \
  -filter_complex "\
    [0:a]volume=1.0[narr];\
    [1:a]adelay=2000|2000,volume=0.15[music];\
    [2:a]adelay=5500|5500,volume=0.7[sfx];\
    [narr][music][sfx]amix=inputs=3:duration=longest" \
  output.m4a
```

## Audio Ducking

Automatically lower music when speech is present.

### Simple Sidechain Compression (Ducking)

```bash
ffmpeg -i narration.mp3 -i music.mp3 \
  -filter_complex "\
    [0:a]asplit=2[narr][sc];\
    [1:a][sc]sidechaincompress=threshold=0.02:ratio=10:attack=50:release=500[ducked];\
    [narr][ducked]amix=inputs=2:duration=first" \
  output.m4a
```

### Parameters Explained

| Parameter | Value | Effect |
|-----------|-------|--------|
| threshold | 0.02 (default 0.125) | Lower = more sensitive to speech |
| ratio | 10:1 | How much to reduce (10:1 = significant duck) |
| attack | 50ms | How fast to duck when speech starts |
| release | 500ms | How fast to return after speech ends |
| knee | 2.82843 | Softness of compression curve |

### Advanced Ducking with Precise Control

```bash
ffmpeg -i narration.mp3 -i music.mp3 \
  -filter_complex "\
    [0:a]asplit=2[narr][sc];\
    [1:a]volume=0.5[music_pre];\
    [music_pre][sc]sidechaincompress=\
      threshold=0.015:\
      ratio=15:\
      attack=30:\
      release=800:\
      makeup=1:\
      knee=6[ducked];\
    [narr][ducked]amix=inputs=2:duration=first:weights='1 0.4'" \
  output.m4a
```

## Mix Ratios by Content Type

```
Content Type          | Narration | Music | SFX  | Notes
---------------------|-----------|-------|------|------------------
Tutorial/How-to      | 100%      | 10%   | 50%  | Voice clarity critical
Corporate/Business   | 100%      | 15%   | 60%  | Professional presence
Social Media         | 100%      | 20%   | 80%  | Higher energy
Documentary          | 100%      | 25%   | 100% | Cinematic feel
Promo/Advertising    | 100%      | 30%   | 100% | Impactful
Music Video          | 50%       | 100%  | 80%  | Music dominant
Podcast              | 100%      | 5%    | 30%  | Minimal distraction
E-learning           | 100%      | 8%    | 40%  | Focus on retention
```

## Loudness Normalization (LUFS)

LUFS (Loudness Units Full Scale) is the broadcast standard for perceived loudness.

### Target Levels by Platform

| Platform | Target LUFS | True Peak | Notes |
|----------|-------------|-----------|-------|
| YouTube | -14 LUFS | -1 dB TP | Auto-normalized |
| Spotify | -14 LUFS | -1 dB TP | Loudness penalty applied |
| Apple Music | -16 LUFS | -1 dB TP | Sound Check |
| Broadcast TV | -24 LUFS | -2 dB TP | EBU R128 standard |
| Podcast | -16 to -19 LUFS | -1 dB TP | Apple spec |
| TikTok/Reels | -14 LUFS | -1 dB TP | Mobile optimization |

### Loudness Normalization Command

```bash
# Normalize to -14 LUFS (YouTube/Spotify standard)
ffmpeg -i input.mp3 \
  -af loudnorm=I=-14:TP=-1:LRA=11 \
  -c:a aac -b:a 192k output.m4a
```

### Two-Pass Normalization (More Accurate)

```bash
# Pass 1: Analyze
ffmpeg -i input.mp3 \
  -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json \
  -f null - 2>&1 | grep -A 12 "output_i"

# Pass 2: Apply measured values
ffmpeg -i input.mp3 \
  -af loudnorm=I=-14:TP=-1:LRA=11:\
measured_I=-18.5:measured_TP=-2.3:measured_LRA=8.2:\
measured_thresh=-28.5:\
linear=true \
  -c:a aac -b:a 192k output.m4a
```

## Multi-Track Production Pipeline

### Complete Video Audio Mix

```bash
ffmpeg -i video.mp4 -i narration.wav -i music.mp3 -i sfx.wav \
  -filter_complex "\
    [1:a]volume=1.0,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[narr];\
    [2:a]volume=0.15,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[music];\
    [3:a]adelay=3000|3000,volume=0.7,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[sfx];\
    [narr][music][sfx]amix=inputs=3:duration=first:normalize=0[mixed];\
    [mixed]loudnorm=I=-14:TP=-1:LRA=11[final]" \
  -map 0:v -map "[final]" \
  -c:v copy -c:a aac -b:a 192k \
  output.mp4
```

### Audio-Only Master Mix

```bash
ffmpeg -i narration.wav -i music.mp3 -i intro_sfx.wav -i outro_sfx.wav \
  -filter_complex "\
    [0:a]volume=1.0[narr];\
    [1:a]volume=0.15[music];\
    [2:a]adelay=0|0,volume=0.8[intro];\
    [3:a]adelay=55000|55000,volume=0.8[outro];\
    [narr][music][intro][outro]amix=inputs=4:duration=longest:weights='3 1 2 2'[mix];\
    [mix]loudnorm=I=-14:TP=-1[final]" \
  -map "[final]" -c:a aac -b:a 256k master_audio.m4a
```

## Quick Reference: Common Patterns

### Pattern 1: Narration + Background Music

```bash
ffmpeg -i narration.mp3 -i music.mp3 \
  -filter_complex "[0:a]volume=1.0[n];[1:a]volume=0.15[m];[n][m]amix=inputs=2:duration=first" \
  output.m4a
```

### Pattern 2: Music with Auto-Duck

```bash
ffmpeg -i narration.mp3 -i music.mp3 \
  -filter_complex "[0:a]asplit=2[n][sc];[1:a][sc]sidechaincompress=threshold=0.02:ratio=10[d];[n][d]amix=inputs=2" \
  output.m4a
```

### Pattern 3: Timed Intro Music Fade

```bash
ffmpeg -i narration.mp3 -i intro_music.mp3 \
  -filter_complex "\
    [1:a]afade=t=out:st=8:d=2,volume=0.3[intro];\
    [0:a]adelay=10000|10000[narr];\
    [intro][narr]amix=inputs=2:duration=longest" \
  output.m4a
```

### Pattern 4: Crossfade Between Segments

```bash
ffmpeg -i segment1.mp3 -i segment2.mp3 \
  -filter_complex "\
    [0:a]afade=t=out:st=28:d=2[s1];\
    [1:a]adelay=28000|28000,afade=t=in:d=2[s2];\
    [s1][s2]amix=inputs=2:duration=longest" \
  output.m4a
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Clipping/distortion | Combined levels too high | Reduce individual volumes or add limiter |
| Narration buried | Music too loud | Reduce music to 10-15%, add ducking |
| Hollow/thin sound | Phase cancellation | Check mono compatibility |
| Pumping artifacts | Aggressive ducking | Increase attack/release times |
| Inconsistent levels | No normalization | Apply loudnorm filter |

### Add Limiter to Prevent Clipping

```bash
ffmpeg -i input.mp3 \
  -af "alimiter=level_in=1:level_out=0.9:limit=0.95:attack=5:release=50" \
  output.m4a
```

## Related Skills

- `video-pacing`: Video rhythm and timing patterns
- `remotion-composer`: Programmatic video generation
- `demo-producer`: Product demo video production
- `thumbnail-first-frame`: Video thumbnail optimization

## References

- [ffmpeg Filters](./references/ffmpeg-filters.md) - Complete audio filter reference
- [Volume Balancing](./references/volume-balancing.md) - Detailed formulas and calculations
- [Ducking Patterns](./references/ducking-patterns.md) - Automatic ducking implementation
