---
title: Embedding Models & API
impact: HIGH
impactDescription: "Wrong embedding model or dimension mismatch causes poor retrieval quality or index incompatibility"
tags: embeddings, models, openai, voyage, ollama, dimensions
---

## Embedding Models & API

Choose the right embedding model and use the API correctly.

**Quick Start:**
```python
from openai import OpenAI
client = OpenAI()

# Single text embedding
response = client.embeddings.create(
    model="text-embedding-3-small",
    input="Your text here"
)
vector = response.data[0].embedding  # 1536 dimensions

# Batch embedding (efficient)
texts = ["text1", "text2", "text3"]
response = client.embeddings.create(
    model="text-embedding-3-small",
    input=texts
)
vectors = [item.embedding for item in response.data]
```

**Model Selection:**

| Model | Dims | Cost | Use Case |
|-------|------|------|----------|
| `text-embedding-3-small` | 1536 | $0.02/1M | General purpose |
| `text-embedding-3-large` | 3072 | $0.13/1M | High accuracy |
| `nomic-embed-text` (Ollama) | 768 | Free | Local/CI |
| `voyage-3` | 1024 | $0.06/1M | Production (OrchestKit) |

**Similarity Calculation:**
```python
import numpy as np

def cosine_similarity(a: list[float], b: list[float]) -> float:
    a, b = np.array(a), np.array(b)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
# 1.0 = identical, 0.0 = orthogonal
```

**Incorrect — mixing different embedding models:**
```python
# Index with one model
docs_embeddings = client.embeddings.create(
    model="text-embedding-3-large",  # 3072 dims
    input=documents
)

# Query with different model
query_embedding = client.embeddings.create(
    model="text-embedding-3-small",  # 1536 dims - MISMATCH!
    input=query
)
# Results will be nonsensical due to dimension mismatch
```

**Correct — consistent model for queries and documents:**
```python
MODEL = "text-embedding-3-small"  # Use same model everywhere

# Index
docs_embeddings = client.embeddings.create(model=MODEL, input=documents)

# Query
query_embedding = client.embeddings.create(model=MODEL, input=query)

# Now cosine similarity is meaningful
similarity = cosine_similarity(query_embedding, docs_embeddings[0])
```

**Key rules:**
- Embed queries and documents with the SAME model — never mix
- Dimension reduction: Can truncate `text-embedding-3-large` to 1536 dims (Matryoshka)
- Batch size: 100-500 texts per API call for efficiency
- Cache embeddings — never re-embed unchanged content
- Most models return normalized vectors (cosine = dot product)
