# ffmpeg Audio Filters Reference

Complete reference for audio filters used in video production mixing.

## Volume and Level Filters

### volume - Adjust Audio Level

```bash
# Basic volume adjustment
volume=0.5              # 50% volume (halve)
volume=2.0              # 200% volume (double)
volume=0dB              # No change
volume=-6dB             # Reduce by 6dB (half perceived loudness)
volume=6dB              # Increase by 6dB (double perceived loudness)

# Examples
ffmpeg -i input.mp3 -af "volume=0.15" output.mp3
ffmpeg -i input.mp3 -af "volume=-20dB" output.mp3
```

### dynaudnorm - Dynamic Audio Normalizer

Automatically adjusts volume to maintain consistent levels.

```bash
# Basic usage
dynaudnorm

# With parameters
dynaudnorm=f=150:g=15:p=0.95:m=10

# Parameters:
# f (framelen): Frame length in ms (default 500)
# g (gausssize): Gaussian window size (default 31)
# p (peak): Target peak value 0.0-1.0 (default 0.95)
# m (maxgain): Maximum gain factor (default 10)

# Example: Gentle normalization for podcast
ffmpeg -i podcast.mp3 -af "dynaudnorm=f=500:g=31:p=0.9:m=5" output.mp3
```

### loudnorm - EBU R128 Loudness Normalization

Industry-standard loudness normalization.

```bash
# Basic normalization to -14 LUFS
loudnorm=I=-14:TP=-1:LRA=11

# Parameters:
# I: Integrated loudness target (LUFS)
# TP: True peak limit (dB)
# LRA: Loudness range target (LU)
# dual_mono: Treat mono as dual mono (default false)
# print_format: Output format (summary/json/none)

# Two-pass for accuracy
# Pass 1: Measure
ffmpeg -i input.mp3 -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null -

# Pass 2: Apply with measured values
ffmpeg -i input.mp3 -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=-22:measured_TP=-4:measured_LRA=9:measured_thresh=-32:offset=0.5:linear=true" output.mp3
```

### alimiter - Audio Limiter

Prevents clipping by limiting peaks.

```bash
alimiter=level_in=1:level_out=0.9:limit=0.95:attack=5:release=50

# Parameters:
# level_in: Input gain (default 1)
# level_out: Output gain (default 1)
# limit: Maximum output level (default 1)
# attack: Attack time in ms (default 5)
# release: Release time in ms (default 50)
# asc: Auto release adjustment (default false)

# Example: Prevent clipping in loud mix
ffmpeg -i loud_mix.mp3 -af "alimiter=level_in=1:level_out=0.9:limit=0.95:attack=5:release=50" output.mp3
```

### compand - Compression/Expansion

Dynamic range compression with multiple control points.

```bash
# Basic compression (reduce dynamic range)
compand=attacks=0:points=-70/-70|-60/-20|0/0

# Aggressive compression for voice
compand=attacks=0.3:decays=0.8:points=-70/-90|-24/-12|0/-6|20/-6

# Parameters:
# attacks: Attack time per channel (seconds)
# decays: Decay time per channel (seconds)
# points: Transfer function (input/output pairs)
# soft-knee: Transition smoothness (dB)
# gain: Output gain
# volume: Initial volume (dB)
```

## Timing and Delay Filters

### adelay - Audio Delay

Delays audio streams for precise timing.

```bash
# Delay both channels by 5 seconds (5000ms)
adelay=5000|5000

# Delay only left channel
adelay=5000|0

# Using samples instead of milliseconds
adelay=240000S|240000S  # 5 seconds at 48kHz

# Apply same delay to all channels
adelay=5000,all=1

# Examples
# Start music 3 seconds into video
ffmpeg -i music.mp3 -af "adelay=3000|3000" delayed_music.mp3

# Offset multiple tracks
ffmpeg -i track1.mp3 -i track2.mp3 \
  -filter_complex "[0:a]adelay=0|0[a];[1:a]adelay=5000|5000[b];[a][b]amix=inputs=2" output.mp3
```

### atrim - Trim Audio

Extract a portion of audio.

```bash
# Extract from 5s to 15s
atrim=start=5:end=15

# Extract first 30 seconds
atrim=end=30

# Extract starting at 10 seconds
atrim=start=10

# Using samples
atrim=start_sample=240000:end_sample=720000

# Example
ffmpeg -i full_audio.mp3 -af "atrim=start=5:end=35,asetpts=PTS-STARTPTS" clip.mp3
```

### asetpts - Set Audio Timestamps

Reset timestamps (required after trimming).

```bash
# Reset to start from 0
asetpts=PTS-STARTPTS

# Used after atrim
ffmpeg -i input.mp3 -af "atrim=start=5:end=15,asetpts=PTS-STARTPTS" output.mp3
```

### apad - Pad Audio

Extend audio with silence.

```bash
# Pad to specific duration (60 seconds)
apad=whole_dur=60

# Pad with specific number of samples
apad=pad_len=48000  # 1 second at 48kHz

# Pad to match longest input in filtergraph
apad=whole_len=0

# Example: Extend short audio to match video length
ffmpeg -i short_audio.mp3 -af "apad=whole_dur=120" padded.mp3
```

## Fade Filters

### afade - Audio Fade

Apply fade in or fade out effects.

```bash
# Fade in over first 2 seconds
afade=t=in:st=0:d=2

# Fade out starting at 28s, lasting 2s
afade=t=out:st=28:d=2

# Parameters:
# t: Type (in/out)
# st: Start time in seconds
# d: Duration in seconds
# curve: Fade curve type

# Curve types:
# tri: Linear (default)
# qsin: Quarter sine wave
# hsin: Half sine wave
# esin: Exponential sine wave
# log: Logarithmic
# ipar: Inverted parabola
# qua: Quadratic
# cub: Cubic
# squ: Square root
# cbr: Cubic root
# par: Parabola
# exp: Exponential
# iqsin/ihsin: Inverted quarter/half sine

# Example: Smooth exponential fade out
ffmpeg -i music.mp3 -af "afade=t=out:st=58:d=2:curve=exp" output.mp3
```

### acrossfade - Crossfade Between Audio

Smooth transition between two audio sources.

```bash
# Basic crossfade (3 second overlap)
acrossfade=d=3

# With custom curves
acrossfade=d=3:c1=tri:c2=tri

# Parameters:
# d: Duration of crossfade
# o: Overlap (default=1)
# c1: Curve for first input fade out
# c2: Curve for second input fade in

# Example: Crossfade two segments
ffmpeg -i segment1.mp3 -i segment2.mp3 \
  -filter_complex "acrossfade=d=3:c1=exp:c2=log" output.mp3
```

## Mixing Filters

### amix - Mix Multiple Audio Streams

Combine multiple audio inputs.

```bash
# Mix 2 inputs
amix=inputs=2

# Mix with duration control
amix=inputs=2:duration=first     # Output length = first input
amix=inputs=2:duration=longest   # Output length = longest input
amix=inputs=2:duration=shortest  # Output length = shortest input

# Mix with weights
amix=inputs=3:weights='3 1 2'    # First input 3x, third 2x weight

# Disable automatic normalization
amix=inputs=2:normalize=0

# Example: Mix narration, music, and SFX
ffmpeg -i narration.mp3 -i music.mp3 -i sfx.mp3 \
  -filter_complex "[0:a][1:a][2:a]amix=inputs=3:duration=first:weights='3 1 2'" output.mp3
```

### amerge - Merge Channels

Merge multiple mono streams into multi-channel.

```bash
# Merge two mono to stereo
amerge=inputs=2

# Example
ffmpeg -i left.mp3 -i right.mp3 \
  -filter_complex "[0:a][1:a]amerge=inputs=2" stereo.mp3
```

### asplit - Split Audio Stream

Create multiple copies of an audio stream.

```bash
# Split into 2 streams
asplit=2

# Split into 3 streams
asplit=3

# Example: Use one stream for output, one for sidechain
ffmpeg -i narration.mp3 -i music.mp3 \
  -filter_complex "[0:a]asplit=2[narr][sidechain];[1:a][sidechain]sidechaincompress[compressed];[narr][compressed]amix" output.mp3
```

## Compression and Dynamics

### sidechaincompress - Sidechain Compression (Ducking)

Compress audio based on another signal.

```bash
# Basic ducking
sidechaincompress=threshold=0.02:ratio=10:attack=50:release=500

# Parameters:
# threshold: Level at which compression starts (0.0-1.0, default 0.125)
# ratio: Compression ratio (1-20, default 2)
# attack: Attack time in ms (default 20)
# release: Release time in ms (default 250)
# makeup: Makeup gain in dB (default 1)
# knee: Knee radius in dB (default 2.82843)
# link: Channel linking (average/maximum, default average)
# detection: Level detection (peak/rms, default rms)
# mix: Wet/dry mix 0.0-1.0 (default 1.0)

# Aggressive ducking for clear voiceover
sidechaincompress=threshold=0.015:ratio=15:attack=30:release=800:knee=6

# Example: Duck music under narration
ffmpeg -i narration.mp3 -i music.mp3 \
  -filter_complex "\
    [0:a]asplit=2[narr][sc];\
    [1:a][sc]sidechaincompress=threshold=0.02:ratio=10:attack=50:release=500[ducked];\
    [narr][ducked]amix=inputs=2" output.mp3
```

### acompressor - Dynamic Range Compressor

Standard audio compression.

```bash
# Basic compression
acompressor=threshold=-20dB:ratio=4:attack=5:release=50

# Parameters:
# threshold: dB level where compression begins
# ratio: Compression ratio
# attack: Attack time in ms
# release: Release time in ms
# makeup: Makeup gain in dB
# knee: Knee in dB
# link: average/maximum
# detection: peak/rms

# Voice compression for consistent levels
acompressor=threshold=-24dB:ratio=3:attack=5:release=100:makeup=6dB

# Example
ffmpeg -i voice.mp3 -af "acompressor=threshold=-20dB:ratio=4:attack=5:release=50:makeup=3dB" output.mp3
```

## Format and Channel Filters

### aformat - Set Audio Format

Ensure consistent sample format, rate, and channels.

```bash
# Set to 48kHz stereo float
aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo

# Common sample formats:
# u8, s16, s32, flt, dbl, s16p, s32p, fltp, dblp

# Example: Standardize before mixing
ffmpeg -i input1.mp3 -i input2.wav \
  -filter_complex "\
    [0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a1];\
    [1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a2];\
    [a1][a2]amix=inputs=2" output.mp3
```

### aresample - Resample Audio

Change sample rate.

```bash
# Resample to 48000 Hz
aresample=48000

# With resampler options
aresample=48000:resampler=soxr

# Example
ffmpeg -i input.mp3 -af "aresample=48000" output.mp3
```

### pan - Remap Channels

Pan or remix audio channels.

```bash
# Stereo to mono (mix both channels)
pan=mono|c0=0.5*c0+0.5*c1

# Mono to stereo (duplicate)
pan=stereo|c0=c0|c1=c0

# Swap left and right
pan=stereo|c0=c1|c1=c0

# Center panned mix
pan=stereo|c0=0.7*c0+0.3*c1|c1=0.3*c0+0.7*c1

# Example
ffmpeg -i stereo.mp3 -af "pan=mono|c0=0.5*c0+0.5*c1" mono.mp3
```

## Analysis Filters

### volumedetect - Detect Volume Levels

Analyze audio levels (output only, no audio modification).

```bash
ffmpeg -i input.mp3 -af "volumedetect" -f null -

# Output includes:
# mean_volume: Average volume in dB
# max_volume: Peak volume in dB
# histogram: Volume distribution
```

### astats - Audio Statistics

Comprehensive audio analysis.

```bash
ffmpeg -i input.mp3 -af "astats" -f null -

# Output includes:
# DC offset, Min/Max level, Peak count
# RMS level, RMS peak, RMS trough
# Crest factor, Flat factor, Peak factor
# Bit depth, Dynamic range, Zero crossings
```

### ebur128 - EBU R128 Loudness Measurement

Professional loudness analysis.

```bash
ffmpeg -i input.mp3 -af "ebur128" -f null -

# Output includes:
# Momentary loudness (M)
# Short-term loudness (S)
# Integrated loudness (I)
# Loudness range (LRA)
# True peak (TP)
```

## Complete Filter Chain Example

```bash
# Professional video audio mix with all techniques
ffmpeg -i video.mp4 -i narration.wav -i music.mp3 -i sfx.wav \
  -filter_complex "\
    [1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,\
         acompressor=threshold=-20dB:ratio=3:attack=5:release=100[narr_proc];\
    [narr_proc]asplit=2[narr][sc];\
    [2:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,\
         volume=0.3[music_pre];\
    [music_pre][sc]sidechaincompress=threshold=0.02:ratio=10:attack=50:release=500[music_ducked];\
    [3:a]adelay=5000|5000,\
         aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,\
         volume=0.7[sfx];\
    [narr][music_ducked][sfx]amix=inputs=3:duration=first:normalize=0[mixed];\
    [mixed]loudnorm=I=-14:TP=-1:LRA=11,\
           alimiter=level_out=0.95[final]" \
  -map 0:v -map "[final]" \
  -c:v copy -c:a aac -b:a 192k \
  output.mp4
```
