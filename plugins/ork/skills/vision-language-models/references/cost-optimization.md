# Vision API Cost Optimization

Strategies to minimize costs while maintaining quality for vision workloads.

## Token Cost by Provider (January 2026)

| Provider | Model | Input ($/M) | Image Cost |
|----------|-------|-------------|------------|
| OpenAI | GPT-5 | $5.00 | ~129 tokens/tile high |
| OpenAI | GPT-4o | $2.50 | 65 tokens low, 129+ high |
| OpenAI | GPT-4o-mini | $0.15 | Same structure, cheaper |
| Anthropic | Claude Opus 4.5 | $5.00 | Per-image pricing |
| Anthropic | Claude Sonnet 4.5 | $3.00 | Per-image pricing |
| Google | Gemini 2.5 Pro | $1.25 | 258 tokens base |
| Google | Gemini 2.5 Flash | $0.15 | 258 tokens base |

## Detail Level Strategy

```python
def select_detail_level(task: str, image_size: tuple) -> str:
    """Select optimal detail level for cost/quality balance."""
    width, height = image_size

    # Low detail tasks (65 tokens)
    low_detail_tasks = [
        "classification",
        "presence_detection",
        "yes_no_question",
        "simple_count",
        "color_identification"
    ]

    if task in low_detail_tasks:
        return "low"

    # High detail required (129+ tokens/tile)
    high_detail_tasks = [
        "ocr",
        "document_analysis",
        "chart_reading",
        "fine_detail",
        "small_text"
    ]

    if task in high_detail_tasks:
        return "high"

    # Auto for everything else
    return "auto"
```

## Image Preprocessing

```python
from PIL import Image

def optimize_image_for_api(
    image_path: str,
    max_dimension: int = 2048,
    quality: int = 85
) -> str:
    """Resize and compress image to minimize tokens."""
    img = Image.open(image_path)

    # Resize if larger than max dimension
    if max(img.size) > max_dimension:
        ratio = max_dimension / max(img.size)
        new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
        img = img.resize(new_size, Image.LANCZOS)

    # Convert RGBA to RGB if needed
    if img.mode == "RGBA":
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[3])
        img = background

    # Save optimized
    output_path = "/tmp/optimized.jpg"
    img.save(output_path, "JPEG", quality=quality, optimize=True)

    return output_path
```

## Batch Processing

```python
async def batch_analyze_images(
    images: list[str],
    prompt: str,
    batch_size: int = 5
) -> list[str]:
    """Batch images to reduce API calls and costs."""
    results = []

    for i in range(0, len(images), batch_size):
        batch = images[i:i + batch_size]

        # Send multiple images in one request
        content = []
        for img_path in batch:
            base64_data, media_type = encode_image_base64(img_path)
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": base64_data
                }
            })

        content.append({
            "type": "text",
            "text": f"Analyze each image and provide: {prompt}\n"
                    f"Format: Image 1: ..., Image 2: ..."
        })

        response = client.messages.create(
            model="claude-sonnet-4-5",  # Cheaper than Opus
            max_tokens=4096,
            messages=[{"role": "user", "content": content}]
        )

        results.append(response.content[0].text)

    return results
```

## Model Tiering

```python
def select_model_for_task(
    task_complexity: str,
    budget: str = "normal"
) -> str:
    """Select cost-appropriate model for task."""
    models = {
        "simple": {
            "budget": "gpt-4o-mini",
            "normal": "gemini-2.5-flash",
            "quality": "gpt-4o"
        },
        "moderate": {
            "budget": "gemini-2.5-flash",
            "normal": "claude-sonnet-4-5",
            "quality": "gpt-5"
        },
        "complex": {
            "budget": "claude-sonnet-4-5",
            "normal": "claude-opus-4-5",
            "quality": "claude-opus-4-5"
        }
    }

    return models.get(task_complexity, models["moderate"])[budget]
```

## Cost Comparison Example

| Scenario | Low Cost | Mid Cost | High Quality |
|----------|----------|----------|--------------|
| 1000 images, simple classification | $1.50 (GPT-4o-mini, low) | $15 (GPT-4o) | $50 (GPT-5) |
| 100 documents, OCR | $3.87 (Gemini Flash) | $15 (Sonnet 4.5) | $50 (Opus 4.5) |
| 50 charts, data extraction | $1.93 (Gemini Flash) | $15 (Sonnet 4.5) | $25 (GPT-5) |

## Best Practices

1. **Start with Flash/Mini**: Use cheapest model first, upgrade if quality insufficient
2. **Resize images**: Never send 4K images for simple tasks
3. **Use low detail**: For classification, presence detection
4. **Batch requests**: Multiple images per API call when possible
5. **Cache results**: Store analysis results, don't re-analyze
6. **Gemini for volume**: $0.15/M tokens for high-volume workloads
