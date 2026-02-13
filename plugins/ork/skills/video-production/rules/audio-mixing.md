---
title: Audio Mixing & Normalization
impact: HIGH
impactDescription: "Poorly mixed audio with competing levels, no ducking, and inconsistent loudness causes viewers to immediately drop off — professional mixing is non-negotiable"
tags: audio, mixing, ffmpeg, ducking, LUFS, normalization, volume
---

## Audio Mixing & Normalization

Combine narration, background music, and sound effects into a balanced mix using ffmpeg filters, ducking patterns, and loudness normalization.

### Target Loudness Standards

| Platform | LUFS | True Peak | Notes |
|----------|------|-----------|-------|
| YouTube | -14 LUFS | -1 dBTP | Recommended standard |
| TikTok/Reels | -14 LUFS | -1 dBTP | Same as YouTube |
| Podcast | -16 LUFS | -1 dBTP | Slightly quieter |
| Broadcast TV | -24 LUFS | -2 dBTP | EBU R128 standard |

### Basic Multi-Track Merge

```bash
# Merge narration + background music
ffmpeg -i narration.wav -i music.mp3 \
  -filter_complex "[1:a]volume=0.15[bg];[0:a][bg]amix=inputs=2:duration=first" \
  -ac 2 -ar 48000 mixed.wav
```

### Sidechain Ducking (Music Ducks Under Voice)

```bash
# Music automatically lowers when narration is present
ffmpeg -i narration.wav -i music.mp3 \
  -filter_complex "\
    [0:a]aformat=fltp:44100:stereo[voice];\
    [1:a]aformat=fltp:44100:stereo[music];\
    [music][voice]sidechaincompress=\
      threshold=0.015:ratio=6:attack=200:release=1000:\
      level_in=1:level_sc=1:mix=0.9[ducked];\
    [voice][ducked]amix=inputs=2:duration=first:weights=1 0.25[out]" \
  -map "[out]" -ac 2 output.wav
```

### Three-Track Mix (Voice + Music + SFX)

```bash
ffmpeg -i voice.wav -i music.mp3 -i sfx.wav \
  -filter_complex "\
    [1:a]volume=0.15[bg];\
    [2:a]volume=0.6[fx];\
    [0:a][bg][fx]amix=inputs=3:duration=first:weights=1 0.3 0.5[mix];\
    [mix]loudnorm=I=-14:TP=-1:LRA=11[out]" \
  -map "[out]" -ac 2 -ar 48000 final.wav
```

### LUFS Normalization

```bash
# Measure current loudness
ffmpeg -i input.wav -af loudnorm=print_format=json -f null - 2>&1 | grep -A 20 "Parsed_loudnorm"

# Two-pass normalization (most accurate)
# Pass 1: Measure
ffmpeg -i input.wav -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1

# Pass 2: Apply measured values
ffmpeg -i input.wav -af loudnorm=I=-14:TP=-1:LRA=11:\
  measured_I=-18.5:measured_TP=-3.2:measured_LRA=8.1:\
  measured_thresh=-28.5:linear=true output.wav
```

### Volume Automation Timeline

```
0s     2s         45s        48s        90s
|------|----------|----------|----------|
 Music   Music      Music      Music
 Fade    Ducked     Full       Fade
 In      (voice)    (no voice) Out
 -30dB   -22dB      -16dB      -inf
```

### Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Clipping on merge | Use `loudnorm` after `amix` |
| Music too loud during narration | Apply sidechain ducking |
| Inconsistent loudness across scenes | Normalize to -14 LUFS |
| Mono output from stereo sources | Always specify `-ac 2` |
| Sample rate mismatch | Use `aformat` to unify to 48000 |

**Key rules:** Always normalize to -14 LUFS as final step. Voice must be 8-12 dB louder than music. Apply ducking before normalization.

**References:** `references/audio-mixing-guide.md`, `references/ffmpeg-audio-filters.md`
