# CLIP and Multimodal Embeddings

Patterns for generating and using CLIP, SigLIP, and Voyage embeddings for multimodal retrieval.

## Model Comparison (2026)

| Model | Dimensions | Context | Strengths |
|-------|------------|---------|-----------|
| CLIP ViT-L/14 | 768 | 77 tokens | General purpose, well-tested |
| SigLIP 2 | 1152 | Standard | Large-scale retrieval |
| Voyage multimodal-3 | 1024 | 32K tokens | Long documents |
| ImageBind | 1024 | Standard | 6 modalities (audio, video) |
| ColPali | 128 | Document | PDF-native |

## CLIP Embeddings (OpenAI)

```python
import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel

class CLIPEmbedder:
    def __init__(self, model_name: str = "openai/clip-vit-large-patch14"):
        self.model = CLIPModel.from_pretrained(model_name)
        self.processor = CLIPProcessor.from_pretrained(model_name)
        self.model.eval()

    def embed_image(self, image_path: str) -> list[float]:
        """Generate normalized image embedding."""
        image = Image.open(image_path).convert("RGB")
        inputs = self.processor(images=image, return_tensors="pt")

        with torch.no_grad():
            features = self.model.get_image_features(**inputs)
            # L2 normalize for cosine similarity
            features = features / features.norm(dim=-1, keepdim=True)

        return features[0].tolist()

    def embed_text(self, text: str) -> list[float]:
        """Generate normalized text embedding."""
        inputs = self.processor(text=[text], return_tensors="pt", padding=True)

        with torch.no_grad():
            features = self.model.get_text_features(**inputs)
            features = features / features.norm(dim=-1, keepdim=True)

        return features[0].tolist()

    def embed_batch(self, items: list, item_type: str = "image") -> list[list[float]]:
        """Batch embed multiple items efficiently."""
        if item_type == "image":
            images = [Image.open(p).convert("RGB") for p in items]
            inputs = self.processor(images=images, return_tensors="pt")
            with torch.no_grad():
                features = self.model.get_image_features(**inputs)
        else:
            inputs = self.processor(text=items, return_tensors="pt", padding=True)
            with torch.no_grad():
                features = self.model.get_text_features(**inputs)

        features = features / features.norm(dim=-1, keepdim=True)
        return features.tolist()
```

## SigLIP 2 (Google)

```python
from transformers import AutoProcessor, AutoModel

class SigLIPEmbedder:
    def __init__(self):
        self.model = AutoModel.from_pretrained("google/siglip-so400m-patch14-384")
        self.processor = AutoProcessor.from_pretrained("google/siglip-so400m-patch14-384")

    def embed_image(self, image_path: str) -> list[float]:
        """SigLIP image embedding with better scaling."""
        image = Image.open(image_path)
        inputs = self.processor(images=image, return_tensors="pt")

        with torch.no_grad():
            outputs = self.model.get_image_features(**inputs)

        return outputs[0].tolist()
```

## Voyage Multimodal-3

```python
import voyageai
import base64

class VoyageMultimodalEmbedder:
    def __init__(self):
        self.client = voyageai.Client()

    def embed(
        self,
        texts: list[str] = None,
        image_paths: list[str] = None
    ) -> list[list[float]]:
        """Embed text and/or images with 32K context."""
        inputs = []

        if texts:
            for text in texts:
                inputs.append({"type": "text", "content": text})

        if image_paths:
            for path in image_paths:
                with open(path, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode()
                    # Detect mime type
                    mime = "image/jpeg" if path.endswith(".jpg") else "image/png"
                    inputs.append({
                        "type": "image",
                        "content": f"data:{mime};base64,{b64}"
                    })

        response = self.client.multimodal_embed(
            inputs=inputs,
            model="voyage-multimodal-3"
        )

        return response.embeddings
```

## Similarity Search

```python
import numpy as np

def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between embeddings."""
    a = np.array(a)
    b = np.array(b)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def search_similar(
    query_embedding: list[float],
    embeddings: list[list[float]],
    top_k: int = 10
) -> list[tuple[int, float]]:
    """Find top-k most similar embeddings."""
    similarities = [
        (i, cosine_similarity(query_embedding, emb))
        for i, emb in enumerate(embeddings)
    ]

    return sorted(similarities, key=lambda x: x[1], reverse=True)[:top_k]
```

## Cross-Modal Search

```python
class CrossModalSearch:
    def __init__(self, embedder: CLIPEmbedder):
        self.embedder = embedder
        self.image_embeddings = []
        self.image_metadata = []

    def index_images(self, image_paths: list[str], metadata: list[dict]):
        """Index images for text-based search."""
        self.image_embeddings = self.embedder.embed_batch(image_paths, "image")
        self.image_metadata = metadata

    def search_text_to_image(self, query: str, top_k: int = 5) -> list[dict]:
        """Find images matching text query."""
        query_emb = self.embedder.embed_text(query)

        results = search_similar(query_emb, self.image_embeddings, top_k)

        return [
            {
                "rank": i + 1,
                "score": score,
                "metadata": self.image_metadata[idx]
            }
            for i, (idx, score) in enumerate(results)
        ]

    def search_image_to_image(self, query_image: str, top_k: int = 5) -> list[dict]:
        """Find similar images."""
        query_emb = self.embedder.embed_image(query_image)

        results = search_similar(query_emb, self.image_embeddings, top_k)

        return [
            {
                "rank": i + 1,
                "score": score,
                "metadata": self.image_metadata[idx]
            }
            for i, (idx, score) in enumerate(results)
        ]
```

## Vector Database Integration

```python
from pymilvus import connections, Collection

class MilvusMultimodalIndex:
    def __init__(self, collection_name: str, dim: int = 768):
        connections.connect("default", host="localhost", port="19530")
        self.collection = Collection(collection_name)
        self.collection.load()

    def insert(
        self,
        ids: list[str],
        embeddings: list[list[float]],
        metadata: list[dict]
    ):
        """Insert embeddings with metadata."""
        entities = [
            ids,
            embeddings,
            [m.get("type", "unknown") for m in metadata],
            [m.get("content", "") for m in metadata],
            [m.get("url", "") for m in metadata]
        ]
        self.collection.insert(entities)

    def search(
        self,
        query_embedding: list[float],
        top_k: int = 10,
        filter_expr: str = None
    ) -> list[dict]:
        """Search with optional filtering."""
        results = self.collection.search(
            data=[query_embedding],
            anns_field="embedding",
            param={"metric_type": "COSINE", "params": {"ef": 64}},
            limit=top_k,
            expr=filter_expr,
            output_fields=["type", "content", "url"]
        )

        return [
            {
                "id": hit.id,
                "score": hit.distance,
                "type": hit.entity.get("type"),
                "content": hit.entity.get("content"),
                "url": hit.entity.get("url")
            }
            for hit in results[0]
        ]
```

## Best Practices

1. **Normalize embeddings**: Always L2 normalize for cosine similarity
2. **Batch processing**: Embed in batches for efficiency (32-64 items)
3. **GPU acceleration**: Use CUDA for large-scale embedding
4. **Cache embeddings**: Store computed embeddings, don't recompute
5. **Hybrid search**: Combine CLIP with text embeddings for best results
6. **Model selection**: Use Voyage for long text, CLIP for general
