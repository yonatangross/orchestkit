# Edge Deployment

## Overview

Deploy LLMs on resource-constrained devices: mobile, edge servers, embedded systems.

**Key constraints**:
- Limited GPU/NPU memory (4-24 GB)
- Power efficiency requirements
- Latency-sensitive applications
- Offline/disconnected operation

---

## Model Selection for Edge

| Device | Memory | Recommended Models |
|--------|--------|-------------------|
| Mobile (iOS/Android) | 4-8 GB | Llama-3.2-1B, Phi-3-mini |
| Edge Server | 16-24 GB | Llama-3.2-3B, Mistral-7B-4bit |
| Raspberry Pi 5 | 8 GB | Gemma-2B, TinyLlama |
| Jetson Orin | 32-64 GB | Llama-3.1-8B, Mixtral-8x7B-4bit |

---

## Aggressive Quantization

For edge, prioritize memory over quality:

```python
from gptqmodel import GPTQModel, QuantizeConfig

# 2-bit quantization for extreme memory constraints
quant_config = QuantizeConfig(
    bits=2,
    group_size=32,
    damp_percent=0.1,
)

model = GPTQModel.load("meta-llama/Llama-3.2-1B-Instruct", quant_config)
model.quantize(calibration_data)
model.save("Llama-3.2-1B-2bit-edge")
```

**Quality vs Memory Trade-off**:
| Bits | Memory (1B model) | Quality Retention |
|------|-------------------|-------------------|
| 4 | ~600 MB | ~95% |
| 3 | ~450 MB | ~85% |
| 2 | ~300 MB | ~70% |

---

## llama.cpp for Edge

Optimized C++ inference for CPU/edge:

```bash
# Build llama.cpp with optimizations
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# For Apple Silicon
make LLAMA_METAL=1

# For CUDA
make LLAMA_CUDA=1

# For Vulkan (cross-platform GPU)
make LLAMA_VULKAN=1

# Run inference
./main -m models/llama-3.2-1b-q4_k_m.gguf \
    -p "Hello, how are you?" \
    -n 128 \
    -ngl 99  # Offload all layers to GPU
```

**GGUF quantization types**:
| Type | Bits | Quality | Speed |
|------|------|---------|-------|
| Q8_0 | 8 | Best | Good |
| Q5_K_M | 5 | Very Good | Better |
| Q4_K_M | 4 | Good | Best |
| Q3_K_M | 3 | Acceptable | Best |
| Q2_K | 2 | Degraded | Best |

---

## Mobile Deployment

### iOS with MLX

```python
# Convert to MLX format for Apple Silicon
import mlx.core as mx
from mlx_lm import load, generate

# Load quantized model
model, tokenizer = load("mlx-community/Llama-3.2-1B-Instruct-4bit")

# Generate on device
prompt = "Explain machine learning briefly:"
response = generate(model, tokenizer, prompt=prompt, max_tokens=100)
```

### Android with MLC-LLM

```bash
# Build for Android
mlc_llm compile meta-llama/Llama-3.2-1B-Instruct \
    --quantization q4f16_1 \
    --target android

# Deploy APK with bundled model
mlc_llm package \
    --model-lib ./dist/llama-3.2-1b-q4f16_1-android.tar \
    --apk-output ./LlamaApp.apk
```

---

## Jetson/NVIDIA Edge

Optimized for Jetson Orin and embedded NVIDIA:

```python
# Use TensorRT-LLM for Jetson
from tensorrt_llm import LLM, SamplingParams

llm = LLM(
    model="meta-llama/Llama-3.2-3B-Instruct",
    max_batch_size=4,  # Limit for memory
    max_input_len=2048,
    max_output_len=512,
)

# Optimized for Jetson memory constraints
outputs = llm.generate(
    prompts=["Hello!"],
    sampling_params=SamplingParams(max_tokens=100),
)
```

---

## Memory Optimization Techniques

### KV Cache Reduction

```python
# Limit context length for edge
llm = LLM(
    model="meta-llama/Llama-3.2-1B-Instruct",
    max_model_len=1024,  # Reduce from default 4096
    gpu_memory_utilization=0.95,  # Maximize usage
)
```

### Sliding Window Attention

```python
# Models with built-in sliding window
# Mistral-7B: 4096 sliding window
# Reduces memory O(n^2) -> O(n*window)

llm = LLM(
    model="mistralai/Mistral-7B-Instruct-v0.3",
    sliding_window=4096,  # Use model's native window
)
```

### Flash Attention

```python
# Enable Flash Attention for memory efficiency
llm = LLM(
    model="meta-llama/Llama-3.2-1B-Instruct",
    use_flash_attention=True,  # Default on supported hardware
)
```

---

## Power Efficiency

### Dynamic Frequency Scaling

```bash
# Limit GPU frequency for power savings (Jetson)
sudo nvpmodel -m 2  # Medium power mode
sudo jetson_clocks --show

# For inference-heavy workloads
sudo nvpmodel -m 0  # Max performance
```

### Batch Size Optimization

```python
# Smaller batches = lower peak power
llm = LLM(
    model="meta-llama/Llama-3.2-1B-Instruct",
    max_num_seqs=8,  # Limit concurrent requests
)

# Process requests sequentially for power
for prompt in prompts:
    output = llm.generate([prompt], sampling_params)
    yield output
```

---

## Offline Deployment

### Model Bundling

```python
# Download and cache model for offline use
from huggingface_hub import snapshot_download

# Pre-download model
snapshot_download(
    "meta-llama/Llama-3.2-1B-Instruct",
    local_dir="./models/llama-3.2-1b",
    local_dir_use_symlinks=False,
)

# Use local path
llm = LLM(model="./models/llama-3.2-1b")
```

### Air-gapped Environments

```bash
# Export model to portable format
python -m llama_cpp.convert \
    --model meta-llama/Llama-3.2-1B-Instruct \
    --output ./llama-3.2-1b.gguf \
    --quantize q4_k_m

# Transfer and run on air-gapped device
./main -m ./llama-3.2-1b.gguf -p "Hello"
```

---

## Benchmarking Edge Performance

```python
import time

def benchmark_edge(model_path: str, prompts: list[str]):
    """Benchmark for edge deployment."""
    from vllm import LLM, SamplingParams

    llm = LLM(
        model=model_path,
        max_model_len=1024,
        gpu_memory_utilization=0.95,
    )

    # Warmup
    llm.generate(["Warmup"], SamplingParams(max_tokens=10))

    # Benchmark
    times = []
    for prompt in prompts:
        start = time.perf_counter()
        output = llm.generate([prompt], SamplingParams(max_tokens=100))
        elapsed = time.perf_counter() - start
        times.append(elapsed)

    avg_latency = sum(times) / len(times)
    p99_latency = sorted(times)[int(len(times) * 0.99)]

    print(f"Avg latency: {avg_latency*1000:.1f}ms")
    print(f"P99 latency: {p99_latency*1000:.1f}ms")
```

---

## Related Skills

- `ollama-local` - Easy local deployment
- `quantization-guide` - Quantization methods
