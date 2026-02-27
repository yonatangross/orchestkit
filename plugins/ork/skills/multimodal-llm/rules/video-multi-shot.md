---
title: Use multi-shot storyboarding and character elements for consistent multi-scene video
impact: HIGH
impactDescription: "Without character elements and multi-shot, each clip generates different-looking characters and disconnected scenes"
tags: video, multi-shot, storyboard, character, consistency, kling
---

## Multi-Shot Storyboarding & Character Consistency

Kling 3.0+ supports multi-shot generation with character elements for identity-consistent scenes. Without this, characters look different in every clip.

**Incorrect — generating separate clips and hoping characters match:**
```python
# WRONG: Each generation creates a different-looking character
clip1 = generate_video("A woman walks into a café")
clip2 = generate_video("A woman orders coffee at a counter")
clip3 = generate_video("A woman sits down and opens a laptop")
# Result: 3 different women, inconsistent clothing, hair, face
```

**Correct — Kling 3.0 multi-shot with character elements:**
```typescript
import { klingai, type KlingAIVideoModelOptions } from '@ai-sdk/klingai';
import { experimental_generateVideo as generateVideo } from 'ai';

const { videos } = await generateVideo({
  model: klingai.video('kling-v3.0-t2v'),
  prompt: 'A woman walks into a café, orders coffee, and sits down',
  providerOptions: {
    klingai: {
      shot_type: 'customize',
      // Multi-shot: each shot gets its own prompt and duration
      multi_prompt: [
        { prompt: '@Element1 walks into a bright café', duration: 5 },
        { prompt: '@Element1 orders coffee at the counter, smiling', duration: 5 },
        { prompt: '@Element1 sits by the window and opens a laptop', duration: 5 },
      ],
      // Character element: up to 3 reference images for identity lock
      elements: [{
        images: [
          'https://...frontal-face.jpg',   // Required: frontal view
          'https://...side-profile.jpg',    // Optional: side angle
          'https://...full-body.jpg',       // Optional: full body
        ],
        // Optional: assign a voice to this character
        voice_id: 'voice_abc123',
      }],
    } satisfies KlingAIVideoModelOptions,
  },
});
```

**Correct — Kling REST API multi-shot (direct):**
```python
response = requests.post(
    f"{BASE_URL}/videos/text2video",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "model": "kling-v3.0",
        "mode": "pro",
        "shot_type": "customize",
        "multi_prompt": [
            {"prompt": "@Element1 enters a modern office", "duration": 5},
            {"prompt": "@Element1 presents to a group, gesturing at a screen", "duration": 5},
        ],
        "elements": [{
            "images": ["https://...frontal.jpg", "https://...profile.jpg"]
        }],
        "aspect_ratio": "16:9",
    }
)
```

**Character element best practices:**

| Guideline | Reason |
|-----------|--------|
| Always include a **frontal face** image | Required for identity lock — model needs clear face features |
| Add **side profile** as 2nd image | Prevents hallucination when character turns |
| Add **full body** as 3rd image | Locks clothing, posture, proportions across shots |
| Max 3 images per element | API limit — choose the 3 most informative angles |
| Reference as `@Element1`, `@Element2` | Prompt syntax for character binding in multi-shot |
| Max 3+ characters in one scene | Kling O3 supports multi-character coreference |

**Scene transition controls:**
- Up to **6 shots** per generation with customizable per-shot duration
- Each shot can have independent camera movement and prompt
- Kling handles transitions between shots automatically
- Total duration: sum of all shot durations (max 15s total)

**Key rules:**
- Multi-shot requires `mode: "pro"` — standard mode only supports single-shot
- Character elements only work with Kling 3.0+ — earlier versions have no identity binding
- Reference images must be publicly accessible HTTPS URLs (no local files)
- Use descriptive prompts per shot — "walks left" is better than "moves" for camera planning
- For 3+ character scenes, use Kling O3 (not V3) — O3 has better multi-character coreference
- Voice IDs are optional — get them from the Kling create-voice endpoint first
