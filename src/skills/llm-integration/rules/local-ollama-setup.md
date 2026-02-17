---
title: "Local Inference: Ollama Setup"
impact: HIGH
impactDescription: "Local LLMs reduce costs by 93% and enable offline development"
tags: [ollama, setup, install, langchain, environment, local]
---

# Ollama Setup & LangChain Integration

## Quick Start

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull models
ollama pull deepseek-r1:70b      # Reasoning (GPT-4 level)
ollama pull qwen2.5-coder:32b    # Coding
ollama pull nomic-embed-text     # Embeddings

# Start server
ollama serve
```

## LangChain Integration

```python
from langchain_ollama import ChatOllama, OllamaEmbeddings

# Chat model
llm = ChatOllama(
    model="deepseek-r1:70b",
    base_url="http://localhost:11434",
    temperature=0.0,
    num_ctx=32768,      # Context window
    keep_alive="5m",    # Keep model loaded
)

# Embeddings
embeddings = OllamaEmbeddings(
    model="nomic-embed-text",
    base_url="http://localhost:11434",
)

# Generate
response = await llm.ainvoke("Explain async/await")
vector = await embeddings.aembed_query("search text")
```

## Tool Calling with Ollama

```python
from langchain_core.tools import tool

@tool
def search_docs(query: str) -> str:
    """Search the document database."""
    return f"Found results for: {query}"

# Bind tools
llm_with_tools = llm.bind_tools([search_docs])
response = await llm_with_tools.ainvoke("Search for Python patterns")
```

## Environment Configuration

```bash
# .env.local
OLLAMA_ENABLED=true
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL_REASONING=deepseek-r1:70b
OLLAMA_MODEL_CODING=qwen2.5-coder:32b
OLLAMA_MODEL_EMBED=nomic-embed-text

# Performance tuning (Apple Silicon)
OLLAMA_MAX_LOADED_MODELS=3    # Keep 3 models in memory
OLLAMA_KEEP_ALIVE=5m          # 5 minute keep-alive
```

## Troubleshooting

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# List loaded models
ollama list

# Check model memory usage
ollama ps

# Pull specific quantization
ollama pull deepseek-r1:70b-q4_K_M
```

## Cost Comparison

| Provider | Monthly Cost | Latency |
|----------|-------------|---------|
| Cloud APIs | ~$675/month | 200-500ms |
| Ollama Local | ~$50 (electricity) | 50-200ms |
| **Savings** | **93%** | **2-3x faster** |

## Common Mistakes

- Not pre-warming models before first call (30-60s cold start)
- Using `keep_alive=-1` (wastes memory indefinitely)
- Skipping environment variable configuration
- Not checking if Ollama is running before making calls

**Incorrect — no keep_alive configuration leads to cold starts:**
```python
from langchain_ollama import ChatOllama

llm = ChatOllama(model="deepseek-r1:70b")  # Model unloaded after each call
response = await llm.ainvoke("Task 1")  # 30-60s cold start
response = await llm.ainvoke("Task 2")  # Another 30-60s cold start
```

**Correct — keep_alive keeps model loaded for subsequent calls:**
```python
from langchain_ollama import ChatOllama

llm = ChatOllama(
    model="deepseek-r1:70b",
    keep_alive="5m"  # Keep model loaded for 5 minutes
)
response = await llm.ainvoke("Task 1")  # 30-60s initial load
response = await llm.ainvoke("Task 2")  # Instant (model still loaded)
```
