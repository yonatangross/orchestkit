# Volume Balancing Reference

Detailed formulas and patterns for professional audio mixing in video production.

## The Fundamental Equation

```
Perceived Loudness = Physical Amplitude x Frequency Response x Duration
```

Human hearing is most sensitive between 2kHz-5kHz (speech intelligibility range), making voice naturally prominent even at equal physical levels.

## dB (Decibels) Explained

```
dB Change    Perceived Effect         Multiplier
-----------------------------------------------------------------
+10 dB       Twice as loud            3.16x amplitude
+6 dB        Noticeably louder        2.0x amplitude
+3 dB        Slightly louder          1.41x amplitude
0 dB         Reference (no change)    1.0x amplitude
-3 dB        Slightly quieter         0.71x amplitude
-6 dB        Noticeably quieter       0.5x amplitude
-10 dB       Half as loud             0.316x amplitude
-20 dB       Quarter as loud          0.1x amplitude
```

### Key Conversions

```
dB to Multiplier:  multiplier = 10^(dB/20)
Multiplier to dB:  dB = 20 * log10(multiplier)

Examples:
-6 dB  = 10^(-6/20)  = 0.501 (approximately 0.5)
-12 dB = 10^(-12/20) = 0.251 (approximately 0.25)
-20 dB = 10^(-20/20) = 0.1
```

## LUFS vs dB

| Measurement | Description | Use Case |
|-------------|-------------|----------|
| dB (peak) | Instantaneous signal level | Prevent clipping |
| dBFS | dB relative to Full Scale | Digital headroom |
| LUFS | Loudness Units Full Scale | Perceived loudness |
| LU | Loudness Unit (relative) | Comparing tracks |

### LUFS Targets by Platform

```
Platform          Integrated LUFS    True Peak    Loudness Range
-----------------------------------------------------------------
YouTube           -14 LUFS           -1 dB TP     6-8 LU
Spotify           -14 LUFS           -1 dB TP     6-8 LU
Apple Music       -16 LUFS           -1 dB TP     8-10 LU
Amazon Music      -14 LUFS           -2 dB TP     6-8 LU
Tidal             -14 LUFS           -1 dB TP     6-8 LU
Netflix           -27 LUFS (dialog)  -2 dB TP     Per scene
Broadcast (EU)    -23 LUFS           -1 dB TP     11 LU max
Broadcast (US)    -24 LUFS           -2 dB TP     Variable
Podcast           -16 to -19 LUFS    -1 dB TP     6-10 LU
Cinema            -27 LUFS (dialog)  -3 dB TP     Per format
```

## Voice-to-Music Balance

### The 3x Rule

**Narration should be approximately 3x louder than background music in perceived volume.**

```
If narration peaks at -6 dBFS:
  Music should peak at approximately -16 to -18 dBFS
  (10-12 dB below narration)
```

### Balance by Content Type

```
Content Type        Voice Level    Music Level    Ratio (Voice:Music)
---------------------------------------------------------------------
Podcast             -16 LUFS       -32 LUFS       16 dB difference
Tutorial            -14 LUFS       -30 LUFS       16 dB difference
Corporate Video     -14 LUFS       -28 LUFS       14 dB difference
Social Media        -14 LUFS       -26 LUFS       12 dB difference
Documentary         -14 LUFS       -24 LUFS       10 dB difference
Film (dialogue)     -27 LUFS       -35 LUFS       8 dB difference
Music Video         -20 LUFS       -14 LUFS       Music dominant
```

### ffmpeg Volume Settings

```bash
# Standard narration + music mix
Narration: volume=1.0 (or volume=0dB)
Music:     volume=0.15 to 0.20 (or volume=-14dB to -16dB)

# By content type
Podcast:     music volume=0.08 to 0.10
Tutorial:    music volume=0.10 to 0.12
Corporate:   music volume=0.12 to 0.15
Social:      music volume=0.15 to 0.20
Documentary: music volume=0.20 to 0.25
```

## Multi-Track Balance Matrix

### Standard Production Mix

```
Track             Multiplier    dB Level    LUFS Target
---------------------------------------------------------
Narration         1.0           0 dB        -14 LUFS
Interview         0.9           -1 dB       -15 LUFS
Sound Effects     0.7           -3 dB       -18 LUFS
Ambient/Atmos     0.3           -10 dB      -24 LUFS
Music Bed         0.15          -16 dB      -30 LUFS
Music (no voice)  0.5           -6 dB       -20 LUFS
```

### Dynamic Balance (with transitions)

```
Segment Type          Voice    Music    SFX     Notes
-----------------------------------------------------------
Intro (music only)    0.0      0.5      0.3     Build energy
Hook (voice enters)   1.0      0.3      0.5     Transition
Main Content          1.0      0.15     0.5     Standard mix
B-Roll Moment         0.0      0.35     0.7     Visual focus
Key Point             1.0      0.1      0.3     Emphasis on voice
CTA/Outro             1.0      0.25     0.5     Closing energy
End Card              0.0      0.5      0.0     Music out
```

## Frequency-Based Balance

Human voice fundamental frequencies:

```
Male voice:   85-180 Hz fundamental, harmonics to 8kHz
Female voice: 165-255 Hz fundamental, harmonics to 8kHz
Child voice:  250-300 Hz fundamental, harmonics to 10kHz

Critical speech frequencies: 500Hz - 4kHz
Sibilance: 4kHz - 8kHz
Presence: 2kHz - 5kHz
```

### EQ Before Mixing

```bash
# Enhance voice clarity with highpass and presence boost
ffmpeg -i narration.mp3 \
  -af "highpass=f=80,lowpass=f=12000,equalizer=f=3000:t=q:w=2:g=2" \
  output.mp3

# Cut conflicting frequencies from music
ffmpeg -i music.mp3 \
  -af "equalizer=f=1000:t=q:w=2:g=-4,equalizer=f=3000:t=q:w=2:g=-6" \
  output.mp3
```

## Headroom Management

### Target Levels

```
Mix Stage              Peak Level    Headroom
----------------------------------------------
Individual tracks      -18 dBFS      18 dB
Submix (voices)        -12 dBFS      12 dB
Submix (music/SFX)     -18 dBFS      18 dB
Master mix             -6 dBFS       6 dB
Final master           -1 dBFS       1 dB (after limiting)
```

### Preventing Clipping

When mixing multiple tracks, combined levels can exceed 0 dBFS:

```
2 tracks at 0 dB each = +3 dB combined (potentially)
3 tracks at 0 dB each = +4.8 dB combined
4 tracks at 0 dB each = +6 dB combined

Solution: Reduce each track by:
2 tracks: -3 dB each
3 tracks: -5 dB each
4 tracks: -6 dB each

Or use amix with normalize=0 and add limiter
```

### Limiter Settings

```bash
# Standard limiter for video production
alimiter=level_in=1:level_out=0.9:limit=0.95:attack=5:release=50

# Aggressive limiter for social media
alimiter=level_in=1.2:level_out=0.95:limit=0.98:attack=2:release=30
```

## Practical Mixing Formulas

### Formula 1: Voice + Music

```bash
# Standard formula
Voice level:  1.0 (reference)
Music level:  0.15 (15% of voice)

ffmpeg -i voice.mp3 -i music.mp3 \
  -filter_complex "[0:a]volume=1.0[v];[1:a]volume=0.15[m];[v][m]amix=inputs=2" output.mp3
```

### Formula 2: Voice + Music + SFX

```bash
# With SFX at 70%
Voice level:  1.0
Music level:  0.15
SFX level:    0.7

ffmpeg -i voice.mp3 -i music.mp3 -i sfx.mp3 \
  -filter_complex "\
    [0:a]volume=1.0[v];\
    [1:a]volume=0.15[m];\
    [2:a]volume=0.7[s];\
    [v][m][s]amix=inputs=3:weights='3 1 2'" output.mp3
```

### Formula 3: Multiple Voices

```bash
# Primary speaker vs secondary/interview
Primary:    1.0
Secondary:  0.9

# Panel discussion (equal weight)
Speaker 1:  0.85
Speaker 2:  0.85
Speaker 3:  0.85
(Reduced to prevent combined clipping)
```

### Formula 4: Music-Only Sections

```bash
# Transition from voice+music to music-only
During voice:   music at 0.15
Music-only:     music at 0.5 (fade up over 1-2 seconds)
Return to voice: music at 0.15 (fade down over 0.5-1 second)

ffmpeg -i voice.mp3 -i music.mp3 \
  -filter_complex "\
    [1:a]volume='if(between(t,10,15),0.5,0.15)':eval=frame[m];\
    [0:a][m]amix=inputs=2" output.mp3
```

## Professional Workflow

### Step 1: Analyze Source Material

```bash
# Check voice levels
ffmpeg -i narration.mp3 -af "loudnorm=I=-14:print_format=json" -f null - 2>&1 | grep -A20 "input_i"

# Check music levels
ffmpeg -i music.mp3 -af "volumedetect" -f null - 2>&1 | grep -E "(mean|max)_volume"
```

### Step 2: Calculate Adjustments

```
If narration measures -22 LUFS and target is -14 LUFS:
  Need +8 LU gain = 10^(8/20) = 2.51x volume multiplier

If music measures -8 LUFS and target is -30 LUFS (under voice):
  Need -22 LU reduction = 10^(-22/20) = 0.079x volume multiplier
```

### Step 3: Apply and Verify

```bash
# Apply calculated levels
ffmpeg -i narration.mp3 -i music.mp3 \
  -filter_complex "\
    [0:a]volume=2.51[v];\
    [1:a]volume=0.08[m];\
    [v][m]amix=inputs=2[mix];\
    [mix]loudnorm=I=-14:TP=-1:LRA=11" output.mp3

# Verify final output
ffmpeg -i output.mp3 -af "ebur128" -f null - 2>&1 | tail -20
```

## Quick Reference Card

```
Voice vs Music Ratios:
  Podcast:     voice 100% : music 8-10%
  Tutorial:    voice 100% : music 10-12%
  Corporate:   voice 100% : music 12-15%
  Social:      voice 100% : music 15-20%
  Cinematic:   voice 100% : music 20-25%

dB Shortcuts:
  -6 dB  = 50% volume
  -12 dB = 25% volume
  -20 dB = 10% volume

LUFS Targets:
  YouTube/Spotify: -14 LUFS
  Podcast:         -16 to -19 LUFS
  Broadcast:       -23 to -24 LUFS

Headroom Rule:
  Keep peaks at -6 dBFS before final limiting
  Final master: -1 dB True Peak maximum
```
