# Inference Optimization Checklist

Performance validation for LLM inference.

## vLLM Configuration

- [ ] Tensor parallelism configured for GPU count
- [ ] Max model length set appropriately
- [ ] GPU memory utilization optimized (0.85-0.95)
- [ ] Prefix caching enabled for shared contexts
- [ ] Continuous batching active

## Quantization

- [ ] Quantization method selected:
  - FP16: Maximum quality, baseline
  - INT8/FP8: Balance quality/efficiency
  - AWQ: Best 4-bit quality
  - GPTQ: Faster quantization
- [ ] Calibration data used (for GPTQ)
- [ ] Quality validated post-quantization

## Speculative Decoding

- [ ] Method selected:
  - N-gram: No extra model, lower overhead
  - Draft model: Higher quality speculation
- [ ] Speculative tokens tuned (3-5 typical)
- [ ] Throughput improvement validated

## Hardware Utilization

- [ ] GPU memory fully utilized
- [ ] Multi-GPU scaling verified
- [ ] NVLink/PCIe bandwidth sufficient
- [ ] CPU not bottlenecking

## Batching Strategy

- [ ] Continuous batching enabled
- [ ] Max batch size configured
- [ ] Request prioritization (if needed)
- [ ] Queue management configured

## Caching

- [ ] KV cache optimized (PagedAttention)
- [ ] Prefix caching for shared prompts
- [ ] Response caching (semantic if applicable)
- [ ] Cache invalidation strategy

## Benchmarking

- [ ] Baseline latency measured
- [ ] Throughput (tokens/sec) benchmarked
- [ ] Time to first token (TTFT) measured
- [ ] Latency under load tested
- [ ] Memory usage profiled

## Production Readiness

- [ ] Warmup requests sent before traffic
- [ ] Health checks configured
- [ ] Graceful shutdown handling
- [ ] Request timeout configured
- [ ] Error recovery tested

## Monitoring

- [ ] Latency metrics (p50, p95, p99)
- [ ] Throughput tracking
- [ ] GPU utilization monitoring
- [ ] Memory usage tracking
- [ ] Error rate alerting

## Cost Optimization

- [ ] Instance size appropriate
- [ ] Spot instances (if applicable)
- [ ] Auto-scaling configured
- [ ] Usage patterns analyzed
- [ ] Cost per request tracked
