---
title: Use async task polling and provider-specific SDKs for reliable video generation
impact: HIGH
impactDescription: "Synchronous calls timeout, missing status polling loses completed videos, wrong SDK patterns cause silent failures"
tags: video, api, kling, fal, ai-sdk, integration, async
---

## Video Generation API Patterns

All video generation APIs are async — submit a task, poll for completion. Never attempt synchronous generation.

**Incorrect — synchronous call expecting immediate result:**
```python
# WRONG: Video generation takes 60-300s, this will timeout
response = requests.post(url, json={"prompt": "..."}, timeout=30)
video_url = response.json()["video_url"]  # Not available yet!
```

**Correct — Kling API with task polling:**
```python
import requests
import time

API_KEY = "your-api-key"
BASE_URL = "https://api.klingai.com/v1"

# 1. Submit generation task
response = requests.post(
    f"{BASE_URL}/videos/text2video",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "model": "kling-v3.0",
        "prompt": "A chef plating a dish in a modern kitchen, warm lighting",
        "duration": "5",
        "aspect_ratio": "16:9",
        "mode": "std",  # std | pro
    }
)
task_id = response.json()["data"]["task_id"]

# 2. Poll for completion (60-90s typical for Kling)
while True:
    status = requests.get(
        f"{BASE_URL}/videos/text2video/{task_id}",
        headers={"Authorization": f"Bearer {API_KEY}"},
    ).json()
    if status["data"]["status"] == "completed":
        video_url = status["data"]["video_url"]
        break
    elif status["data"]["status"] == "failed":
        raise RuntimeError(f"Generation failed: {status['data']['error']}")
    time.sleep(10)
```

**Correct — fal.ai SDK (serverless, no GPU management):**
```python
import fal_client

# Kling V3 text-to-video via fal.ai
result = fal_client.run(
    "fal-ai/kling-video/v3/pro/text-to-video",
    arguments={
        "prompt": "A knight in weathered armor, cinematic lighting",
        "duration": "10",
        "aspect_ratio": "16:9",
    }
)
video_url = result["video"]["url"]
```

**Correct — Vercel AI SDK (TypeScript):**
```typescript
import { klingai, type KlingAIVideoModelOptions } from '@ai-sdk/klingai';
import { experimental_generateVideo as generateVideo } from 'ai';

// Text-to-video
const { videos } = await generateVideo({
  model: klingai.video('kling-v3.0-t2v'),
  prompt: 'A cat playing in autumn leaves, warm afternoon light',
  aspectRatio: '16:9',
  duration: 5,
  providerOptions: {
    klingai: { mode: 'std' } satisfies KlingAIVideoModelOptions,
  },
});

// Image-to-video with start + end frame
const { videos: i2v } = await generateVideo({
  model: klingai.video('kling-v3.0-i2v'),
  prompt: { image: startFrameUrl, text: 'The subject turns and smiles' },
  duration: 5,
  providerOptions: {
    klingai: {
      mode: 'pro',        // Pro required for end-frame
      imageTail: endFrameUrl,
    } satisfies KlingAIVideoModelOptions,
  },
});
```

**Callback pattern (preferred over polling for production):**
```python
# Register a webhook URL when creating the task
response = requests.post(
    f"{BASE_URL}/videos/text2video",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "prompt": "...",
        "callback_url": "https://your-app.com/api/video-webhook",
    }
)
# Your webhook receives POST with task_id + video_url on completion
```

**Key rules:**
- Always implement exponential backoff on polling — don't hammer the API every second
- Set generation timeout at 10 minutes minimum — complex scenes take longer
- Kling `mode: "pro"` costs ~2x more than `mode: "std"` but enables end-frame control and higher quality
- fal.ai and AI SDK abstract the polling — prefer these over raw REST for new projects
- Store `task_id` persistently — if your process crashes, you can resume polling
- Validate image URLs are publicly accessible before passing to image-to-video endpoints
