# vLLM Deployment

## PagedAttention

vLLM's PagedAttention manages KV cache memory in non-contiguous blocks, enabling:

- **Efficient memory**: Only allocates what's needed per request
- **Dynamic batching**: Handles variable sequence lengths
- **Up to 24x throughput**: Compared to naive implementations

```python
from vllm import LLM, SamplingParams

# PagedAttention is enabled by default
llm = LLM(
    model="meta-llama/Meta-Llama-3.1-70B-Instruct",
    gpu_memory_utilization=0.9,  # Use 90% GPU memory for KV cache
    max_num_seqs=256,  # Max concurrent sequences
    max_model_len=8192,  # Max context length
)
```

---

## Continuous Batching

Dynamic batching that doesn't wait for batch completion:

```python
from vllm import AsyncLLMEngine, AsyncEngineArgs, SamplingParams

# Configure async engine for continuous batching
engine_args = AsyncEngineArgs(
    model="meta-llama/Meta-Llama-3.1-8B-Instruct",
    max_num_batched_tokens=8192,  # Max tokens per batch
    max_num_seqs=64,  # Max concurrent sequences
    enable_chunked_prefill=True,  # Better latency for long prompts
)

engine = AsyncLLMEngine.from_engine_args(engine_args)

# Requests are automatically batched
async def generate(prompt: str):
    sampling_params = SamplingParams(max_tokens=512)
    generator = engine.generate(prompt, sampling_params, request_id="req-1")
    async for output in generator:
        yield output.outputs[0].text
```

---

## CUDA Graphs

Capture and replay CUDA operations for faster execution:

```bash
# Enable via CLI
vllm serve meta-llama/Meta-Llama-3.1-8B-Instruct \
    --enforce-eager false  # Enable CUDA graphs (default)

# Disable for debugging
vllm serve meta-llama/Meta-Llama-3.1-8B-Instruct \
    --enforce-eager true  # Disable CUDA graphs
```

```python
# Python API
llm = LLM(
    model="meta-llama/Meta-Llama-3.1-8B-Instruct",
    enforce_eager=False,  # Enable CUDA graphs
)
```

**Note**: CUDA graphs require fixed input shapes. vLLM handles this automatically with padding.

---

## Tensor Parallelism

Scale across multiple GPUs:

```bash
# 4-GPU tensor parallelism
vllm serve meta-llama/Meta-Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4

# With pipeline parallelism (for very large models)
vllm serve meta-llama/Meta-Llama-3.3-405B-Instruct \
    --tensor-parallel-size 4 \
    --pipeline-parallel-size 2
```

```python
llm = LLM(
    model="meta-llama/Meta-Llama-3.1-70B-Instruct",
    tensor_parallel_size=4,
    distributed_executor_backend="ray",  # For multi-node
)
```

**GPU Requirements**:
| Model Size | GPUs (FP16) | GPUs (INT8) | GPUs (AWQ/GPTQ) |
|-----------|-------------|-------------|-----------------|
| 7B | 1 | 1 | 1 |
| 13B | 1 | 1 | 1 |
| 70B | 4 | 2 | 1-2 |
| 405B | 8+ | 4+ | 4+ |

---

## Prefix Caching

Reuse KV cache for shared prompt prefixes:

```python
llm = LLM(
    model="meta-llama/Meta-Llama-3.1-8B-Instruct",
    enable_prefix_caching=True,  # Enable prefix caching
)

# Shared system prompt benefits from caching
system_prompt = "You are a helpful assistant. Be concise and accurate."
prompts = [
    f"{system_prompt}\n\nUser: What is Python?",
    f"{system_prompt}\n\nUser: Explain REST APIs.",
    f"{system_prompt}\n\nUser: What is Docker?",
]

# First request computes system prompt KV cache
# Subsequent requests reuse cached prefix
outputs = llm.generate(prompts, SamplingParams(max_tokens=256))
```

**Benefits**:
- Reduced TTFT (time to first token) for shared prefixes
- Lower GPU memory for batch requests
- Ideal for: chat systems, RAG with fixed context

---

## Production Server Configuration

```bash
# Production vLLM server
vllm serve meta-llama/Meta-Llama-3.1-70B-Instruct \
    --host 0.0.0.0 \
    --port 8000 \
    --tensor-parallel-size 4 \
    --max-model-len 8192 \
    --max-num-seqs 128 \
    --gpu-memory-utilization 0.9 \
    --enable-prefix-caching \
    --disable-log-requests \
    --api-key $VLLM_API_KEY

# With quantization
vllm serve meta-llama/Meta-Llama-3.1-70B-Instruct \
    --quantization awq \
    --dtype half \
    --tensor-parallel-size 2 \
    --gpu-memory-utilization 0.85
```

**OpenAI-compatible API**:

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="your-api-key",
)

response = client.chat.completions.create(
    model="meta-llama/Meta-Llama-3.1-70B-Instruct",
    messages=[{"role": "user", "content": "Hello!"}],
    max_tokens=256,
)
```

---

## Monitoring and Metrics

vLLM exposes Prometheus metrics:

```bash
# Enable metrics
vllm serve ... --enable-metrics

# Metrics endpoint
curl http://localhost:8000/metrics
```

Key metrics:
- `vllm:num_requests_running`: Active requests
- `vllm:num_requests_waiting`: Queued requests
- `vllm:gpu_cache_usage_perc`: KV cache utilization
- `vllm:avg_prompt_throughput_toks_per_s`: Input throughput
- `vllm:avg_generation_throughput_toks_per_s`: Output throughput

---

## Related Skills

- `observability-monitoring` - Production monitoring patterns
- `performance-testing` - Load testing inference endpoints
