---
title: Use multimodal embedding models for cross-modal search across text and images
impact: HIGH
impactDescription: "Using text-only embeddings for mixed content misses image information — multimodal models enable cross-modal search"
tags: clip, siglip, voyage-multimodal, image-embedding, cross-modal
---

## Multimodal Embeddings

Embed images and text in the same vector space for cross-modal retrieval.

**Model Selection:**

| Model | Context | Modalities | Best For |
|-------|---------|------------|----------|
| **Voyage multimodal-3** | 32K tokens | Text + Image | Long documents |
| **SigLIP 2** | Standard | Text + Image | Large-scale retrieval |
| **CLIP ViT-L/14** | 77 tokens | Text + Image | General purpose |
| **ImageBind** | Standard | 6 modalities | Audio/video included |
| **ColPali** | Document | Text + Image | PDF/document RAG |

**CLIP Embeddings:**
```python
from transformers import CLIPProcessor, CLIPModel
import torch

model = CLIPModel.from_pretrained("openai/clip-vit-large-patch14")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-large-patch14")

def embed_image(image_path: str) -> list[float]:
    image = Image.open(image_path)
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        embeddings = model.get_image_features(**inputs)
    embeddings = embeddings / embeddings.norm(dim=-1, keepdim=True)
    return embeddings[0].tolist()

def embed_text(text: str) -> list[float]:
    inputs = processor(text=[text], return_tensors="pt", padding=True)
    with torch.no_grad():
        embeddings = model.get_text_features(**inputs)
    embeddings = embeddings / embeddings.norm(dim=-1, keepdim=True)
    return embeddings[0].tolist()
```

**Voyage Multimodal-3 (Long Context):**
```python
import voyageai
client = voyageai.Client()

def embed_multimodal(texts=None, images=None) -> list[list[float]]:
    inputs = []
    if texts:
        inputs.extend([{"type": "text", "content": t} for t in texts])
    if images:
        for path in images:
            with open(path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode()
                inputs.append({"type": "image", "content": f"data:image/png;base64,{b64}"})
    return client.multimodal_embed(inputs=inputs, model="voyage-multimodal-3").embeddings
```

**Incorrect — using text-only embeddings for images:**
```python
def embed_image(image_path: str) -> list[float]:
    # Using text embedding model for images - wrong modality!
    caption = generate_caption(image_path)
    return text_embed_model.embed([caption])[0]  # Loses visual features
```

**Correct — multimodal embeddings for cross-modal search:**
```python
def embed_image(image_path: str) -> list[float]:
    image = Image.open(image_path)
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        embeddings = model.get_image_features(**inputs)
    embeddings = embeddings / embeddings.norm(dim=-1, keepdim=True)  # Normalize
    return embeddings[0].tolist()
```

**Key rules:**
- Normalize embeddings for cosine similarity (CLIP already normalized)
- Voyage multimodal-3 for long documents (32K context)
- SigLIP 2 for large-scale production retrieval
- Always embed both images AND captions for maximum coverage
