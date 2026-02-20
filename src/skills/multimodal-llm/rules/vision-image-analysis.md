---
title: Encode images correctly with content array structure to prevent silent vision failures
impact: HIGH
impactDescription: "Wrong image encoding or missing content array structure causes silent failures — model receives no image data"
tags: vision, image, base64, multi-image, object-detection, captioning, vqa
---

## Vision Image Analysis

Encode images correctly and structure multi-modal messages for each provider.

**Incorrect — string content instead of content array:**
```python
# OpenAI — image silently ignored
response = client.chat.completions.create(
    model="gpt-5.2",
    messages=[{"role": "user", "content": f"Describe this image: {base64_data}"}]
)
```

**Correct — structured content array with image_url:**
```python
import base64, mimetypes

def encode_image(path: str) -> tuple[str, str]:
    mime_type = mimetypes.guess_type(path)[0] or "image/png"
    with open(path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8"), mime_type

# OpenAI (GPT-5, GPT-4o)
base64_data, mime_type = encode_image(image_path)
response = client.chat.completions.create(
    model="gpt-5.2",
    max_tokens=4096,  # Required for vision — omitting truncates response
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {
                "url": f"data:{mime_type};base64,{base64_data}",
                "detail": "high"  # low=65 tokens, high=129+ tokens/tile
            }}
        ]
    }]
)
```

**Claude — different content structure (type: "image", not "image_url"):**
```python
response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=4096,
    messages=[{
        "role": "user",
        "content": [
            {"type": "image", "source": {
                "type": "base64",
                "media_type": media_type,
                "data": base64_data
            }},
            {"type": "text", "text": prompt}
        ]
    }]
)
```

**Gemini — uses PIL Image directly:**
```python
from PIL import Image
model = genai.GenerativeModel("gemini-2.5-pro")
image = Image.open(image_path)
response = model.generate_content([prompt, image])
```

**Multi-image comparison (Claude supports up to 100):**
```python
content = []
for img_path in images:
    b64, mt = encode_image(img_path)
    content.append({"type": "image", "source": {"type": "base64", "media_type": mt, "data": b64}})
content.append({"type": "text", "text": "Compare these images..."})
response = client.messages.create(model="claude-opus-4-6", max_tokens=8192, messages=[{"role": "user", "content": content}])
```

**Object detection with bounding boxes (Gemini 2.5+):**
```python
response = model.generate_content([
    "Detect all objects. Return JSON: {objects: [{label, box: [x1,y1,x2,y2]}]}",
    image
])
```

**Key rules:**
- Always set `max_tokens` on vision requests (responses truncated without it)
- Resize images to max 2048px before encoding (reduces cost and latency)
- Use `detail: "low"` (65 tokens) for simple classification, `"high"` for OCR/charts
- Each provider has different content structure — do not mix formats
- Claude uses `media_type`, OpenAI uses `mime` in the data URI
