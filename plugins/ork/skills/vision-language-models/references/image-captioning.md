# Image Captioning Patterns

Best practices for generating high-quality image descriptions and captions using vision models.

## Model Selection for Captioning

| Task | Best Model | Why |
|------|------------|-----|
| Detailed descriptions | Claude Opus 4.5 | Best visual reasoning |
| Concise captions | GPT-4o-mini | Fast, cost-effective |
| Alt text (accessibility) | Claude Sonnet 4.5 | Balanced quality |
| Batch captioning | Gemini 2.5 Flash | Cheapest at scale |

## Basic Captioning

```python
import anthropic

client = anthropic.Anthropic()

def generate_caption(
    image_path: str,
    style: str = "descriptive"
) -> str:
    """Generate image caption with style control."""
    prompts = {
        "descriptive": "Describe this image in detail. Include objects, actions, setting, and mood.",
        "concise": "Write a one-sentence caption for this image.",
        "alt_text": "Write an alt text description for accessibility. Be concise but include key visual information.",
        "creative": "Write a creative, engaging caption for this image suitable for social media.",
        "technical": "Describe the technical aspects of this image: composition, lighting, colors, and style."
    }

    base64_data, media_type = encode_image_base64(image_path)

    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": base64_data
                    }
                },
                {"type": "text", "text": prompts.get(style, prompts["descriptive"])}
            ]
        }]
    )

    return response.content[0].text
```

## Structured Caption Output

```python
from pydantic import BaseModel
from typing import Optional

class ImageCaption(BaseModel):
    short_caption: str
    detailed_description: str
    objects: list[str]
    scene_type: str
    mood: Optional[str]
    colors: list[str]
    alt_text: str

def generate_structured_caption(image_path: str) -> ImageCaption:
    """Generate structured caption with multiple formats."""
    prompt = """Analyze this image and provide:
1. short_caption: One sentence summary
2. detailed_description: 2-3 sentences with full details
3. objects: List of main objects/subjects
4. scene_type: indoor, outdoor, portrait, product, etc.
5. mood: emotional tone if applicable
6. colors: dominant colors
7. alt_text: accessibility description

Return as JSON matching the schema."""

    base64_data, media_type = encode_image_base64(image_path)

    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1000,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": base64_data
                    }
                },
                {"type": "text", "text": prompt}
            ]
        }]
    )

    import json
    data = json.loads(response.content[0].text)
    return ImageCaption(**data)
```

## Batch Captioning

```python
async def batch_caption_images(
    image_paths: list[str],
    batch_size: int = 5
) -> list[str]:
    """Efficiently caption multiple images."""
    captions = []

    for i in range(0, len(image_paths), batch_size):
        batch = image_paths[i:i + batch_size]

        content = []
        for j, path in enumerate(batch):
            base64_data, media_type = encode_image_base64(path)
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
            "text": f"Caption each image (1-2 sentences each).\n"
                    f"Format:\nImage 1: [caption]\nImage 2: [caption]\n..."
        })

        response = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=2000,
            messages=[{"role": "user", "content": content}]
        )

        # Parse individual captions
        text = response.content[0].text
        for line in text.split("\n"):
            if line.startswith("Image"):
                caption = line.split(":", 1)[1].strip()
                captions.append(caption)

    return captions
```

## Accessibility Alt Text

```python
def generate_alt_text(
    image_path: str,
    context: str = None
) -> str:
    """Generate WCAG-compliant alt text."""
    prompt = """Write alt text for this image following accessibility best practices:
- Be concise (under 125 characters ideally)
- Describe key visual content
- Skip "image of" or "picture of"
- Include text visible in the image
- Convey the purpose/meaning, not just appearance"""

    if context:
        prompt += f"\n\nContext where image appears: {context}"

    base64_data, media_type = encode_image_base64(image_path)

    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=200,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": base64_data
                    }
                },
                {"type": "text", "text": prompt}
            ]
        }]
    )

    return response.content[0].text.strip()
```

## Caption for Search Indexing

```python
def generate_search_caption(image_path: str) -> str:
    """Generate caption optimized for search/retrieval."""
    prompt = """Describe this image for search indexing. Include:
- All visible objects and subjects
- Actions taking place
- Text visible in the image
- Colors, brands, or identifiable items
- Setting and context
- Any notable details

Be thorough but factual. Use keywords that someone might search for."""

    base64_data, media_type = encode_image_base64(image_path)

    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": base64_data
                    }
                },
                {"type": "text", "text": prompt}
            ]
        }]
    )

    return response.content[0].text
```

## Quality Guidelines

1. **Be specific**: "Golden retriever running on beach" > "Dog outside"
2. **Include context**: Mention setting, time of day, mood
3. **Avoid assumptions**: Describe what's visible, not interpretations
4. **For alt text**: Focus on function, not just appearance
5. **For search**: Include synonyms and related terms
6. **For social**: Match brand voice and platform norms
