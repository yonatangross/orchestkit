# Platform-Specific Requirements

Comprehensive specifications for thumbnails and first frames across all major video platforms.

## YouTube

### Standard Videos (Long-form)

```
THUMBNAIL SPECIFICATIONS
========================
Resolution:        1280 x 720 pixels (minimum)
Recommended:       1920 x 1080 pixels
Aspect ratio:      16:9
File size:         < 2 MB
Formats:           JPG, GIF, PNG, BMP
Color space:       sRGB
```

```
SAFE ZONE DIAGRAM
=================

+--------------------------------------------------+
|  [Watch Later] [Add to Queue]         [3 dots]   |
|                                                  |
|                                                  |
|            SAFE ZONE FOR CONTENT                 |
|            (center 80% recommended)              |
|                                                  |
|                                                  |
|                                        [10:34]   |
+--------------------------------------------------+

OVERLAYS TO AVOID:
- Top right corner: Menu icons
- Bottom right: Duration timestamp
- Top left: Watch Later on hover
```

### YouTube Shorts

```
THUMBNAIL SPECIFICATIONS
========================
Resolution:        1080 x 1920 pixels
Aspect ratio:      9:16
Auto-generated:    Yes (can select frame)
Custom upload:     Limited availability

Note: Shorts thumbnail is often the first frame
```

```
SAFE ZONE DIAGRAM
=================

+------------------+
|   [Profile]      |
|                  |
|                  |
|   SAFE ZONE      |
|   (center        |
|    70%)          |
|                  |
|                  |
|        [Like]    |
|        [Comment] |
|        [Share]   |
|                  |
|  [@username]     |
|  [Description]   |
|  [Sound]         |
+------------------+
```

### YouTube Cards and End Screens

```
END SCREEN PLACEMENT
====================

+--------------------------------------------------+
|                                                  |
|                                                  |
|     +--------+  +--------+                       |
|     |VIDEO 1 |  |VIDEO 2 |  (last 20 seconds)    |
|     +--------+  +--------+                       |
|                                                  |
|           +------------+                         |
|           | SUBSCRIBE  |                         |
|           +------------+                         |
+--------------------------------------------------+

Design thumbnails knowing end screens will overlay
final 20 seconds. Don't put critical content there.
```

## TikTok

### Video Thumbnails

```
THUMBNAIL SPECIFICATIONS
========================
Resolution:        1080 x 1920 pixels
Aspect ratio:      9:16
Cover image:       Selected from video or uploaded
Max file size:     N/A (from video frame)
```

```
SAFE ZONE DIAGRAM
=================

+------------------+
| [Following|ForU] |  <- Top navigation
|                  |
|                  |
|   SAFE ZONE      |
|   (center 60%)   |
|                  |
|                  |
|         [icons]  |  <- Like, comment, share, etc.
|                  |
| [@user] [desc]   |  <- Username and description
| [#tags] [sound]  |  <- Hashtags and sound info
+------------------+

CRITICAL AVOID ZONES:
- Right side: Action icons (20% width)
- Bottom: Username/description (15% height)
- Top: Navigation bar (8% height)
```

### TikTok Photo Mode

```
SPECIFICATIONS
==============
Format:            Up to 35 photos
Aspect ratio:      9:16
Resolution:        1080 x 1920
Cover selection:   First photo or custom
```

## Instagram

### Reels

```
THUMBNAIL SPECIFICATIONS
========================
Resolution:        1080 x 1920 pixels
Aspect ratio:      9:16
Cover image:       From video or uploaded
Profile grid:      1:1 center crop displayed
```

```
SAFE ZONE DIAGRAM
=================

+------------------+
| [Reels]          |
|                  |
|                  |
|   SAFE ZONE      |
|   (center 60%)   |
|                  |
|                  |
|        [icons]   |
|                  |
| [user] [follow]  |
| [description]    |
| [audio]          |
+------------------+

GRID PREVIEW CONSIDERATION:
When displayed in profile grid (1:1),
only the center square is visible:

+------------------+
|    [cropped]     |
|  +----------+    |
|  | VISIBLE  |    |
|  | IN GRID  |    |
|  +----------+    |
|    [cropped]     |
+------------------+
```

### Instagram Feed Posts

```
THUMBNAIL SPECIFICATIONS
========================
Square:            1080 x 1080 (1:1)
Portrait:          1080 x 1350 (4:5)
Landscape:         1080 x 608 (1.91:1)

Video cover:       Same aspect as video
```

### Instagram Stories

```
SPECIFICATIONS
==============
Resolution:        1080 x 1920 pixels
Aspect ratio:      9:16
Duration:          Up to 60 seconds
No custom thumb:   Auto-generated
```

## Twitter/X

### Video Thumbnails

```
THUMBNAIL SPECIFICATIONS
========================
Resolution:        1280 x 720 (minimum)
Recommended:       1920 x 1080
Aspect ratio:      16:9
File size:         < 5 MB
Formats:           JPG, PNG
```

```
SAFE ZONE DIAGRAM
=================

+------------------------------------------+
|                                    [GIF] |
|                                          |
|         SAFE ZONE                        |
|         (full width usable)              |
|                                          |
|  [play button]                  [length] |
+------------------------------------------+

TIMELINE PREVIEW:
Videos show as embedded player with
play button overlay centered.
```

## LinkedIn

### Video Thumbnails

```
THUMBNAIL SPECIFICATIONS
========================
Resolution:        1200 x 627 pixels
Aspect ratio:      1.91:1
Alternative:       1920 x 1080 (16:9)
File size:         < 8 MB
Formats:           JPG, PNG
```

```
SAFE ZONE DIAGRAM
=================

+--------------------------------------------+
|                                            |
|                                            |
|          SAFE ZONE                         |
|          (center 85%)                      |
|                                            |
|  [play]                           [time]   |
+--------------------------------------------+

FEED BEHAVIOR:
- Videos autoplay muted in feed
- Thumbnail shows briefly before play
- Mobile crop may be tighter
```

## Facebook

### Feed Videos

```
THUMBNAIL SPECIFICATIONS
========================
Resolution:        1280 x 720 (minimum)
Recommended:       1920 x 1080
Aspect ratio:      16:9, 1:1, or 4:5
File size:         < 10 MB
Formats:           JPG, PNG
```

```
SAFE ZONE DIAGRAM (16:9)
========================

+------------------------------------------+
|  [HD]                                    |
|                                          |
|         SAFE ZONE                        |
|                                          |
|                                          |
|  [play]      [sound]            [expand] |
+------------------------------------------+
```

### Facebook Reels

```
SPECIFICATIONS
==============
Resolution:        1080 x 1920
Aspect ratio:      9:16
Cover:             Selected from video
Duration:          Up to 90 seconds
```

## Vimeo

### Video Thumbnails

```
THUMBNAIL SPECIFICATIONS
========================
Resolution:        1280 x 720 (minimum)
Recommended:       1920 x 1080
Aspect ratio:      16:9
File size:         < 10 MB
Formats:           JPG, PNG, GIF

SHOWCASE THUMBNAILS:
Resolution:        1920 x 1080
Same requirements as video
```

## Twitch

### Stream Thumbnails

```
SPECIFICATIONS
==============
Resolution:        1920 x 1080
Aspect ratio:      16:9
File size:         < 10 MB
Formats:           JPG, PNG
Update frequency:  Every few minutes (live)
```

### VOD Thumbnails

```
SPECIFICATIONS
==============
Auto-generated:    Yes
Custom upload:     Yes (same as stream)
Resolution:        1920 x 1080
```

## Cross-Platform Template

```
UNIVERSAL SAFE ZONE (works everywhere)
======================================

16:9 (Horizontal)
+------------------------------------------+
|  10%                                10%  |
|  +----------------------------------+    |
|  |                                  |    |
|  |     UNIVERSAL SAFE ZONE          |    |
|  |     (center 80%)                 |    |
|  |                                  |    |
|  +----------------------------------+    |
|  10%                                10%  |
+------------------------------------------+

9:16 (Vertical)
+------------------+
|       15%        |
|  +----------+    |
|  | SAFE     |    |
|  | ZONE     |    |
|  | (center  |    |
|  |  60%)    |    |
|  +----------+    |
|       25%        |
+------------------+
```

## Export Settings by Platform

### FFmpeg Export Commands

```bash
# YouTube (16:9)
ffmpeg -i input.mp4 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -preset slow -crf 18 \
  -c:a aac -b:a 192k \
  youtube_output.mp4

# TikTok/Reels (9:16)
ffmpeg -i input.mp4 \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -preset slow -crf 20 \
  -c:a aac -b:a 128k \
  vertical_output.mp4

# Twitter (16:9, lower bitrate)
ffmpeg -i input.mp4 \
  -vf "scale=1280:720" \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  twitter_output.mp4
```

### Remotion Export Config

```typescript
// remotion.config.ts

import { Config } from '@remotion/cli/config';

// YouTube settings
Config.Output.setCodec('h264');
Config.Output.setImageFormat('jpeg');
Config.Output.setQuality(80);

// Export options
export const youtubeConfig = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 30 * 60, // 1 minute
};

export const shortsConfig = {
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 30 * 60, // 1 minute
};

// Thumbnail export (first frame)
// npx remotion still src/index.tsx Thumbnail --frame=0 --output=thumbnail.png
```

## Thumbnail File Preparation

### Image Optimization Pipeline

```bash
# Step 1: Export from design tool at 2x
# Example: 3840 x 2160 for YouTube

# Step 2: Optimize with sharp/imagemagick
convert input.png \
  -resize 1920x1080 \
  -quality 85 \
  -strip \
  -interlace Plane \
  thumbnail.jpg

# Step 3: Verify file size
ls -lh thumbnail.jpg
# Should be < 2MB for YouTube

# Step 4: Verify dimensions
identify thumbnail.jpg
# Should show 1920x1080
```

### Node.js Optimization (Sharp)

```typescript
import sharp from 'sharp';

async function optimizeThumbnail(
  input: string,
  output: string,
  platform: 'youtube' | 'tiktok' | 'twitter'
) {
  const dimensions = {
    youtube: { width: 1920, height: 1080 },
    tiktok: { width: 1080, height: 1920 },
    twitter: { width: 1280, height: 720 },
  };

  const { width, height } = dimensions[platform];

  await sharp(input)
    .resize(width, height, {
      fit: 'cover',
      position: 'center',
    })
    .jpeg({
      quality: 85,
      progressive: true,
    })
    .toFile(output);
}
```

## Platform Update Tracking

```
LAST VERIFIED: January 2026

PLATFORM          SPEC VERSION    NOTES
========          ============    =====
YouTube           Current         Shorts expanding custom thumbs
TikTok            Current         Photo mode thumbnails updated
Instagram         Current         Reels grid crop unchanged
Twitter/X         Current         Video player refresh coming
LinkedIn          Current         No recent changes
Facebook          Current         Reels prioritized in feed
```

## Quick Reference Table

```
PLATFORM          HORIZONTAL      VERTICAL        MAX SIZE
========          ==========      ========        ========
YouTube           1920x1080       1080x1920       2 MB
TikTok            N/A             1080x1920       N/A
Instagram Reels   N/A             1080x1920       N/A
Instagram Feed    1080x608        1080x1350       N/A
Twitter/X         1920x1080       N/A             5 MB
LinkedIn          1200x627        N/A             8 MB
Facebook          1920x1080       1080x1920       10 MB
Vimeo             1920x1080       N/A             10 MB
Twitch            1920x1080       N/A             10 MB
```
