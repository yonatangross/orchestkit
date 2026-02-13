# SFX Library Reference for Tech Demo Videos

Comprehensive sound effect library organized by category with timing recommendations and usage guidelines.

## Core SFX Categories

### 1. Keyboard and Typing Sounds

#### Mechanical Keyboard
| Sound | Duration | Use Case |
|-------|----------|----------|
| Cherry MX Blue Click | 50-80ms | Tactile coding, emphasis |
| Cherry MX Red Press | 30-50ms | Smooth typing |
| Buckling Spring | 80-120ms | Retro/vintage feel |
| Topre Thock | 60-90ms | Premium feel |

**Layering Strategy:**
```
Base: Primary keystroke (70% volume)
Variation 1: Alternate key (random trigger, 60% volume)
Variation 2: Different finger (random trigger, 50% volume)
Spacebar: Distinct longer sound (100% volume)
Enter: Satisfying completion sound (110% volume)
```

#### Typing Patterns
```
Normal typing: 8-12 keys per second
Fast typing: 15-20 keys per second
Slow/careful: 3-5 keys per second
Code completion: Burst then pause
```

#### Typing SFX Files Needed
- `key_press_01.wav` through `key_press_05.wav`
- `spacebar.wav`
- `enter_key.wav`
- `backspace.wav`
- `tab_key.wav`

### 2. Mouse and Cursor Sounds

#### Click Sounds
| Type | Characteristic | Use |
|------|----------------|-----|
| Soft click | Subtle, professional | General UI |
| Mechanical click | Tactile, satisfying | Important actions |
| Double click | Quick succession | File/folder open |
| Right click | Slightly different tone | Context menus |

#### Cursor Movement
| Sound | Trigger | Volume |
|-------|---------|--------|
| Hover whoosh | Entering interactive element | -18dB |
| Selection highlight | Text selection | -20dB |
| Drag start | Beginning drag operation | -15dB |
| Drop | Releasing dragged item | -12dB |

### 3. UI Interaction Sounds

#### Buttons and Controls
```
Button hover:    Subtle rise, 50-100ms
Button click:    Sharp attack, quick decay, 80-150ms
Toggle on:       Rising pitch, positive feel
Toggle off:      Falling pitch, neutral feel
Slider move:     Continuous subtle friction
Checkbox tick:   Quick, satisfying click
Radio select:    Soft pop with tail
```

#### Navigation
```
Tab switch:      Swoosh with direction (left/right)
Page transition: Longer whoosh, 200-400ms
Scroll:          Subtle movement, very quiet
Menu open:       Unfolding/expanding sound
Menu close:      Folding/collapsing sound
Dropdown:        Quick cascade down
Accordion:       Stretch/compress sound
```

#### Form Interactions
```
Input focus:     Subtle highlight sound
Input valid:     Positive micro-chime
Input invalid:   Soft warning tone
Form submit:     Confirming click
Form success:    Triumphant resolution
Form error:      Attention-getting but not harsh
```

### 4. Notification and Alert Sounds

#### Priority Levels
| Level | Sound Character | Duration | Volume |
|-------|-----------------|----------|--------|
| Info | Neutral ping | 200-400ms | -14dB |
| Success | Positive chime | 300-500ms | -12dB |
| Warning | Attention tone | 400-600ms | -10dB |
| Error | Alert sound | 300-500ms | -8dB |
| Critical | Urgent alarm | 500-800ms | -6dB |

#### Notification Sounds Needed
- `notification_info.wav`
- `notification_success.wav`
- `notification_warning.wav`
- `notification_error.wav`
- `badge_update.wav`
- `message_received.wav`

### 5. Transition and Movement Sounds

#### Whooshes
| Type | Speed | Duration | Use Case |
|------|-------|----------|----------|
| Fast whoosh | Quick | 100-200ms | Rapid transitions |
| Medium whoosh | Moderate | 200-400ms | Standard scene changes |
| Slow whoosh | Gentle | 400-800ms | Dramatic reveals |
| Directional whoosh | Varies | 200-400ms | Indicating direction |

#### Other Transitions
```
Fade transition: Subtle white noise fade
Wipe transition: Directional sweep sound
Zoom in:         Rising pitch, approaching
Zoom out:        Falling pitch, receding
Cut:             Optional impact sound
Dissolve:        Ethereal blend
```

### 6. Success and Achievement Sounds

#### Completion Sounds
| Event | Sound Type | Emotion |
|-------|------------|---------|
| Task complete | Rising chime | Satisfaction |
| Level up | Fanfare | Achievement |
| Milestone | Celebration | Pride |
| Perfect score | Special flourish | Excellence |
| Streak | Building pattern | Momentum |

#### Technical Successes
```
Build successful:    Positive confirmation, 400-600ms
Tests passing:       Quick success cascade
Deploy complete:     Triumphant but professional
Connection made:     Linking/connecting sound
Sync complete:       Harmonious resolution
```

### 7. Error and Warning Sounds

#### Error Hierarchy
```
Validation error:    Soft buzz, 150-250ms, -14dB
Action failed:       Distinct error tone, 300-400ms, -12dB
System error:        Serious warning, 400-600ms, -10dB
Critical failure:    Urgent alert, 500-800ms, -8dB
```

#### Warning Sounds
```
Caution:            Gentle attention sound
Time warning:       Subtle urgency
Resource warning:   Increasing tension
Security alert:     Sharp, distinct tone
```

### 8. Data and Processing Sounds

#### Data Flow
| Sound | Use | Characteristics |
|-------|-----|-----------------|
| Data stream | Background processing | Continuous, subtle |
| Packet transfer | Individual data units | Quick blips |
| Download | Receiving data | Filling/incoming |
| Upload | Sending data | Emptying/outgoing |
| Sync | Bidirectional | Harmonious exchange |

#### Processing Indicators
```
Loading loop:       Subtle rhythmic pattern (loopable)
Thinking:           Contemplative ambience
Calculating:        Quick computational sounds
Searching:          Scanning/sweeping effect
Analyzing:          Complex processing texture
```

### 9. Spawn and Appear Sounds

#### Object Appearance
| Style | Sound | Duration |
|-------|-------|----------|
| Pop in | Quick bubble pop | 100-150ms |
| Fade in | Ethereal materialize | 200-400ms |
| Slide in | Whoosh with stop | 200-300ms |
| Scale in | Growing/expanding | 150-250ms |
| Glitch in | Digital artifact | 100-200ms |

#### Element Spawning
```
Card appear:        Soft placement sound
Modal open:         Expanding with presence
Toast notification: Slide + attention ping
Tooltip:            Subtle pop
Dropdown items:     Cascade effect
```

### 10. Ambient and Background Sounds

#### Tech Ambience
| Sound | Use Case | Volume |
|-------|----------|--------|
| Server room | Infrastructure context | -24dB |
| Office ambient | Workspace setting | -26dB |
| Digital hum | Tech atmosphere | -28dB |
| Data center | Large scale operations | -24dB |

#### Subtle Textures
```
Circuit activity:   Very quiet electronic pulse
Digital rain:       Matrix-style data fall
Network traffic:    Subtle packet sounds
System idle:        Barely perceptible hum
```

## SFX Timing Quick Reference

### Frame-Based Timing (30fps)

| Event | Pre-sound | Main Sound | Post-sound |
|-------|-----------|------------|------------|
| Button click | 0 | Frame 0-3 | 0 |
| Transition | 0-2 frames | Frame 3-12 | 2-4 frames |
| Success | 0 | Frame 0-10 | 5-15 frames |
| Error | 0 | Frame 0-8 | 3-8 frames |
| Spawn | 0-3 frames | Frame 0-6 | 0-3 frames |

### Timing Offsets
```
Anticipation:   -3 to -1 frames before visual
Synchronous:    Frame 0 with visual
Delayed:        +1 to +3 frames after visual
Extended tail:  Visual ends, sound continues 5-15 frames
```

## Volume Normalization

### Standard Levels
```
Primary SFX:        -12dB peak
Secondary SFX:      -18dB peak
Ambient:            -24dB peak
Notification:       -10dB peak
Subtle feedback:    -20dB peak
```

### Dynamic Range
```
Quiet sounds:       -24 to -18dB
Normal sounds:      -18 to -12dB
Prominent sounds:   -12 to -6dB
Maximum impact:     -6 to -3dB (rare)
```

## File Format Specifications

### Recommended Formats
| Format | Use Case | Quality |
|--------|----------|---------|
| WAV | Source files | Uncompressed |
| FLAC | Archive | Lossless compressed |
| MP3 | Web delivery | 320kbps |
| OGG | Web delivery | q8-q10 |
| AAC | Mobile | 256kbps |

### Audio Specifications
```
Sample rate:     48kHz (video standard)
Bit depth:       24-bit (editing), 16-bit (delivery)
Channels:        Stereo or Mono depending on use
Normalization:   -3dB true peak maximum
```

## SFX Sourcing Checklist

For each sound needed:
- [ ] Clear audio without artifacts
- [ ] Appropriate length (not too long)
- [ ] Clean attack and natural decay
- [ ] Correct sample rate (48kHz)
- [ ] License verified for intended use
- [ ] Normalized to standard level
- [ ] Named consistently
- [ ] Organized in project folder
