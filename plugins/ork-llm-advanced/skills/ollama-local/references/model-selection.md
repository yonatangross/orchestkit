# Model Selection Guide

Choose the right Ollama model for your task and hardware.

## Model Comparison (2026)

| Model | Size | VRAM | Benchmark | Best For |
|-------|------|------|-----------|----------|
| deepseek-r1:70b | 42GB | 48GB+ | GPT-4 level | Reasoning, analysis |
| qwen2.5-coder:32b | 35GB | 40GB+ | 73.7% Aider | Code generation |
| llama3.2:70b | 40GB | 48GB+ | Strong | General purpose |
| llama3.2:7b | 4GB | 8GB+ | Good | Fast inference |
| nomic-embed-text | 0.5GB | 2GB | 768 dims | Embeddings |

## Hardware Requirements

```python
HARDWARE_PROFILES = {
    "m4_max_256gb": {
        "reasoning": "deepseek-r1:70b",
        "coding": "qwen2.5-coder:32b",
        "general": "llama3.2:70b",
        "embeddings": "nomic-embed-text",
        "max_loaded": 3
    },
    "m3_pro_36gb": {
        "reasoning": "llama3.2:7b",
        "coding": "qwen2.5-coder:7b",
        "general": "llama3.2:7b",
        "embeddings": "nomic-embed-text",
        "max_loaded": 2
    },
    "ci_runner": {
        "all": "llama3.2:7b",  # Fast, low memory
        "embeddings": "nomic-embed-text",
        "max_loaded": 1
    }
}

def get_model_for_task(task: str, hardware: str = "m4_max_256gb") -> str:
    """Select model based on task and available hardware."""
    profile = HARDWARE_PROFILES[hardware]
    return profile.get(task, profile.get("general", "llama3.2:7b"))
```

## Quantization Options

```bash
# Full precision (best quality, most VRAM)
ollama pull deepseek-r1:70b

# Q4_K_M quantization (good balance)
ollama pull deepseek-r1:70b-q4_K_M

# Q4_0 quantization (fastest, lowest quality)
ollama pull deepseek-r1:70b-q4_0
```

## Configuration

- Context window: 32768 tokens (Apple Silicon)
- keep_alive: 5m for CI, -1 for dev
- Quantization: q4_K_M for production balance

## Cost Optimization

- Pre-warm models before batch jobs
- Use smaller models for simple tasks
- Load max 2-3 models simultaneously
- CI: Use 7B models (93% cheaper than cloud)